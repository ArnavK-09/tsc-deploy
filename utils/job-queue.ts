import { eq, and, desc, sql } from "drizzle-orm";
import { db, buildJobs, deployments, BuildJob, NewBuildJob } from "../db";
import { SnapshotProcessor, BuildProgress } from "./snapshot-processor";
import { GitHubService } from "../shared/github.service";
import { DEPLOY_URL } from "../shared/constants";
import { generatePRComment } from "./pr-comment";
import type { PRCommentData } from "./pr-comment";
import { env } from "../shared/env";

export interface BuildJobData {
  deploymentId: string;
  owner: string;
  repo: string;
  ref: string;
  environment: string;
  eventType: string;
  meta: string;
  context: {
    serverUrl: string;
    runId: string;
    sha: string;
    message?: string;
  };
  deploymentId_github: number;
  checkRunId?: number;
  create_release?: boolean;
  githubToken: string;
  repoArchiveUrl?: string;
}

export class JobQueue {
  private static instance: JobQueue;
  private isProcessing = false;
  private processingPromise?: Promise<void>;

  private constructor() {}

  static getInstance(): JobQueue {
    if (!JobQueue.instance) {
      JobQueue.instance = new JobQueue();
    }
    return JobQueue.instance;
  }

  async queueBuild(jobData: BuildJobData, priority: number = 0): Promise<string> {
    const newJob: NewBuildJob = {
      deploymentId: jobData.deploymentId,
      status: "queued",
      priority,
      metadata: jobData,
    };

    const [job] = await db.insert(buildJobs).values(newJob).returning();
    
    this.startProcessing();
    
    return job.id;
  }

  async getBuildStatus(jobId: string): Promise<BuildJob | null> {
    const [job] = await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.id, jobId))
      .limit(1);

    return job || null;
  }

  async getQueueLength(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(buildJobs)
      .where(eq(buildJobs.status, "queued"));

    return result.count;
  }

  private async startProcessing() {
    if (this.isProcessing) {
      return this.processingPromise;
    }

    this.isProcessing = true;
    this.processingPromise = this.processJobs();
    
    try {
      await this.processingPromise;
    } finally {
      this.isProcessing = false;
      this.processingPromise = undefined;
    }
  }

  private async processJobs() {
    while (true) {
      const nextJob = await this.getNextJob();
      
      if (!nextJob) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      await this.processJob(nextJob);
    }
  }

  private async getNextJob(): Promise<BuildJob | null> {
    const [job] = await db
      .select()
      .from(buildJobs)
      .where(eq(buildJobs.status, "queued"))
      .orderBy(desc(buildJobs.priority), buildJobs.queuedAt)
      .limit(1);

    if (!job) return null;

    await db
      .update(buildJobs)
      .set({
        status: "processing",
        startedAt: new Date(),
        workerNodeId: process.env.HOSTNAME || "unknown",
      })
      .where(eq(buildJobs.id, job.id));

    return { ...job, status: "processing" as const };
  }

  private async processJob(job: BuildJob) {
    const jobData = job.metadata as BuildJobData;
    let workingDirectory: string | null = null;

    try {
      console.log(`Processing job ${job.id} for deployment ${jobData.deploymentId}`);

      await this.updateJobProgress(job.id, 5, "Initializing build environment...");

      workingDirectory = await this.downloadRepository(jobData);
      
      await this.updateJobProgress(job.id, 20, "Repository downloaded, starting build...");

      const snapshot = await this.buildProject(job.id, workingDirectory);

      await this.updateJobProgress(job.id, 90, "Finalizing deployment...");

      await this.finalizeBuild(job, jobData, snapshot);

      await db
        .update(buildJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          progress: 100,
        })
        .where(eq(buildJobs.id, job.id));

      console.log(`Job ${job.id} completed successfully`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`Job ${job.id} failed:`, error);

      await db
        .update(buildJobs)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage,
          retryCount: sql`${buildJobs.retryCount} + 1`,
        })
        .where(eq(buildJobs.id, job.id));

      if (job.retryCount < job.maxRetries) {
        console.log(`Retrying job ${job.id} (attempt ${job.retryCount + 1}/${job.maxRetries})`);
        await db
          .update(buildJobs)
          .set({
            status: "queued",
            startedAt: null,
            completedAt: null,
          })
          .where(eq(buildJobs.id, job.id));
      } else {
        await this.handleJobFailure(job, jobData, errorMessage);
      }
    } finally {
      if (workingDirectory) {
        await this.cleanupWorkspace(workingDirectory);
      }
    }
  }

  private async downloadRepository(jobData: BuildJobData): Promise<string> {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { exec } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { FileHandler } = await import("./file-handler");
    
    const execAsync = promisify(exec);
    const workDir = path.join("/tmp", `build-${jobData.deploymentId}`);
    
    fs.mkdirSync(workDir, { recursive: true });

    if (jobData.repoArchiveUrl) {
      try {
        const archivePath = path.join("/tmp", `archive-${jobData.deploymentId}.tar.gz`);
        
        const downloadCommand = `curl -L -H "Authorization: token ${jobData.githubToken}" "${jobData.repoArchiveUrl}" -o "${archivePath}"`;
        await execAsync(downloadCommand);
        
        const isValidSize = await FileHandler.validateFileSize(archivePath);
        if (!isValidSize) {
          throw new Error("Repository archive exceeds maximum file size limit");
        }
        
        await FileHandler.extractArchive(archivePath, workDir);
        
        const extractedDirs = fs.readdirSync(workDir);
        if (extractedDirs.length === 1) {
          const extractedDir = path.join(workDir, extractedDirs[0]);
          const tempDir = path.join("/tmp", `temp-${jobData.deploymentId}`);
          fs.renameSync(extractedDir, tempDir);
          fs.rmSync(workDir, { recursive: true });
          fs.renameSync(tempDir, workDir);
        }
        
        await FileHandler.cleanup([archivePath]);
      } catch (error) {
        console.warn("Archive download failed, falling back to git clone:", error);
        const cloneUrl = `https://x-access-token:${jobData.githubToken}@github.com/${jobData.owner}/${jobData.repo}.git`;
        await execAsync(`git clone ${cloneUrl} .`, { cwd: workDir });
        await execAsync(`git checkout ${jobData.ref}`, { cwd: workDir });
      }
    } else {
      const cloneUrl = `https://x-access-token:${jobData.githubToken}@github.com/${jobData.owner}/${jobData.repo}.git`;
      await execAsync(`git clone ${cloneUrl} .`, { cwd: workDir });
      await execAsync(`git checkout ${jobData.ref}`, { cwd: workDir });
    }

    return workDir;
  }

  private async buildProject(jobId: string, workingDirectory: string) {
    const processor = new SnapshotProcessor(
      workingDirectory,
      (progress: BuildProgress) => {
        const overallProgress = Math.round((progress.progress * 0.7) + 20);
        this.updateJobProgress(jobId, overallProgress, progress.message).catch(console.error);
      }
    );

    return await processor.generateSnapshot();
  }

  private async finalizeBuild(job: BuildJob, jobData: BuildJobData, snapshot: any) {
    const userOctokit = new GitHubService({ token: jobData.githubToken });
    const botOctokit = new GitHubService({ token: env.GITHUB_BOT_TOKEN });

    const totalTime = Math.round((Date.now() - new Date(job.startedAt!).getTime()) / 1000);

    // Update deployment in database
    await db
      .update(deployments)
      .set({
        snapshotResult: snapshot,
        buildDuration: totalTime,
        buildCompletedAt: new Date(),
        status: snapshot.success ? "ready" : "error",
        errorMessage: snapshot.error || null,
        totalCircuitFiles: snapshot.circuitFiles?.length || 0,
      })
      .where(eq(deployments.id, jobData.deploymentId));

    if (snapshot.success) {
      // Update GitHub deployment status
      await userOctokit.createDeploymentStatus({
        owner: jobData.owner,
        repo: jobData.repo,
        deploymentId: jobData.deploymentId_github,
        state: "success",
        description: `Successfully built ${snapshot.circuitFiles.length} circuit${snapshot.circuitFiles.length === 1 ? "" : "s"} in ${totalTime}s`,
        logUrl: `${jobData.context.serverUrl}/${jobData.owner}/${jobData.repo}/actions/runs/${jobData.context.runId}`,
      });

      // Generate and post PR comment for pull requests
      if (jobData.eventType === "pull_request") {
        try {
          const prCommentData: PRCommentData = {
            deploymentId: jobData.deploymentId,
            previewUrl: `${DEPLOY_URL}/deployments/${jobData.deploymentId_github}`,
            buildTime: `${totalTime}s`,
            circuitCount: snapshot.circuitFiles.length,
            status: "ready",
            snapshotResult: snapshot,
          };

          const prComment = generatePRComment(prCommentData);

          await botOctokit.createPRComment({
            owner: jobData.owner,
            repo: jobData.repo,
            issueNumber: Number(jobData.meta),
            body: prComment,
          });

          console.log(`PR comment posted for deployment ${jobData.deploymentId}`);
        } catch (error) {
          console.error("Failed to post PR comment:", error);
        }
      }

      // Update check run for pull requests
      if (jobData.checkRunId) {
        try {
          await userOctokit.updateCheckRun({
            owner: jobData.owner,
            repo: jobData.repo,
            checkRunId: jobData.checkRunId,
            status: "completed",
            conclusion: "success",
            detailsUrl: `${DEPLOY_URL}/deployments/${jobData.deploymentId_github}`,
            output: {
              title: "✅ Preview Deploy Ready",
              summary: `Successfully built ${snapshot.circuitFiles.length} circuit${snapshot.circuitFiles.length === 1 ? "" : "s"} in ${totalTime}s`,
              text: `## 🔗 Preview URL\n${DEPLOY_URL}/deployments/${jobData.deploymentId_github}\n\n## 📊 Build Details\n- Circuits: ${snapshot.circuitFiles.length}\n- Build time: ${totalTime}s\n- Status: Ready`,
            },
          });

          console.log(`Check run updated for deployment ${jobData.deploymentId}`);
        } catch (error) {
          console.error("Failed to update check run:", error);
        }
      }

      // Handle release creation for push events
      if (jobData.eventType === "push" && jobData.create_release) {
        try {
          const branch = jobData.ref.replace("refs/heads/", "");
          if (branch === "main" || branch === "master") {
            const { tag: lastTag } = await userOctokit.getLatestTag({
              owner: jobData.owner,
              repo: jobData.repo,
            });

            const commitMessage = jobData.context?.message || "";
            const packageVersion = userOctokit.generateNextVersion(
              lastTag,
              commitMessage,
            );

            const { tagSha } = await userOctokit.createTag({
              owner: jobData.owner,
              repo: jobData.repo,
              tag: `v${packageVersion}`,
              message: `Release v${packageVersion}`,
              object: jobData.ref.replace("refs/heads/", ""),
              type: "commit",
            });

            if (tagSha) {
              await userOctokit.createRef({
                owner: jobData.owner,
                repo: jobData.repo,
                ref: `refs/tags/v${packageVersion}`,
                sha: tagSha,
              });

              console.log(`Release v${packageVersion} created for deployment ${jobData.deploymentId}`);
            }
          }
        } catch (error) {
          console.error("Error creating release:", error);
        }
      }
    }
  }

  private async handleJobFailure(job: BuildJob, jobData: BuildJobData, errorMessage: string) {
    const userOctokit = new GitHubService({ token: jobData.githubToken });
    const botOctokit = new GitHubService({ token: env.GITHUB_BOT_TOKEN });

    // Update deployment status
    await db
      .update(deployments)
      .set({
        status: "error",
        errorMessage,
        buildCompletedAt: new Date(),
      })
      .where(eq(deployments.id, jobData.deploymentId));

    // Update GitHub deployment status
    await userOctokit.createDeploymentStatus({
      owner: jobData.owner,
      repo: jobData.repo,
      deploymentId: jobData.deploymentId_github,
      state: "error",
      description: `Build failed: ${errorMessage}`,
    });

    // Post failure comment to PR
    if (jobData.eventType === "pull_request") {
      try {
        const failureComment = `## ❌ tscircuit Deploy Failed

**Deployment ID:** \`${jobData.deploymentId}\`
**Error:** ${errorMessage}

Please check your circuit files and try again.

---
*Powered by [tscircuit](https://tscircuit.com)*`;

        await botOctokit.createPRComment({
          owner: jobData.owner,
          repo: jobData.repo,
          issueNumber: Number(jobData.meta),
          body: failureComment,
        });

        console.log(`Failure comment posted for deployment ${jobData.deploymentId}`);
      } catch (error) {
        console.error("Failed to post failure comment:", error);
      }
    }

    // Update check run
    if (jobData.checkRunId) {
      try {
        await userOctokit.updateCheckRun({
          owner: jobData.owner,
          repo: jobData.repo,
          checkRunId: jobData.checkRunId,
          status: "completed",
          conclusion: "failure",
          output: {
            title: "❌ Build Failed",
            summary: `Build failed: ${errorMessage}`,
          },
        });

        console.log(`Check run updated with failure for deployment ${jobData.deploymentId}`);
      } catch (error) {
        console.error("Failed to update check run with failure:", error);
      }
    }
  }

  private async updateJobProgress(jobId: string, progress: number, message: string) {
    await db
      .update(buildJobs)
      .set({
        progress,
        logs: sql`COALESCE(${buildJobs.logs}, '') || ${`[${new Date().toISOString()}] ${message}\n`}`,
      })
      .where(eq(buildJobs.id, jobId));
  }

  private async cleanupWorkspace(workingDirectory: string) {
    try {
      const fs = await import("node:fs");
      fs.rmSync(workingDirectory, { recursive: true, force: true });
      console.log(`Cleaned up workspace: ${workingDirectory}`);
    } catch (error) {
      console.warn(`Failed to cleanup workspace ${workingDirectory}:`, error);
    }
  }
} 