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

  async queueBuild(
    jobData: BuildJobData,
    priority: number = 0,
  ): Promise<string> {
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
        await new Promise((resolve) => setTimeout(resolve, 5000));
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
      console.log(
        `Processing job ${job.id} for deployment ${jobData.deploymentId}`,
      );

      await this.updateJobProgress(
        job.id,
        5,
        "Initializing build environment...",
      );

      console.log(`Starting to download repository for job ${job.id}`);
      workingDirectory = await this.downloadRepository(jobData);
      console.log(`Repository downloaded for job ${job.id} to ${workingDirectory}`);

      await this.updateJobProgress(
        job.id,
        20,
        "Repository downloaded, starting build...",
      );

      console.log(`Starting build for job ${job.id}`);
      const snapshot = await this.buildProject(job.id, workingDirectory);
      console.log(`Build completed for job ${job.id}, snapshot created`);

      await this.updateJobProgress(job.id, 90, "Finalizing deployment...");

      console.log(`Finalizing build for job ${job.id}`);
      await this.finalizeBuild(job, jobData, snapshot);
      console.log(`Build finalized for job ${job.id}`);

      await db
        .update(buildJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          progress: 100,
        })
        .where(eq(buildJobs.id, job.id));
      console.log(`Job ${job.id} marked as completed in database`);

      console.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`Job ${job.id} failed:`, error);

      // Check if this is a non-retryable error
      const isNonRetryable = 
        errorMessage.includes("404 Not Found") ||
        errorMessage.includes("403 Forbidden") ||
        errorMessage.includes("repository may be private") ||
        errorMessage.includes("Archive URL may be invalid");

      await db
        .update(buildJobs)
        .set({
          status: "failed",
          completedAt: new Date(),
          errorMessage,
          retryCount: sql`${buildJobs.retryCount} + 1`,
        })
        .where(eq(buildJobs.id, job.id));

      if (!isNonRetryable && job.retryCount < job.maxRetries) {
        console.log(
          `Retrying job ${job.id} (attempt ${job.retryCount + 1}/${job.maxRetries})`,
        );
        
        // Add exponential backoff delay for retries
        const delayMs = Math.min(1000 * Math.pow(2, job.retryCount), 30000); // Max 30 seconds
        console.log(`Retrying job ${job.id} in ${delayMs}ms`);
        
        setTimeout(async () => {
          await db
            .update(buildJobs)
            .set({
              status: "queued",
              startedAt: null,
              completedAt: null,
            })
            .where(eq(buildJobs.id, job.id));
        }, delayMs);
      } else {
        if (isNonRetryable) {
          console.log(`Job ${job.id} failed with non-retryable error: ${errorMessage}`);
        } else {
          console.log(`Job ${job.id} failed after ${job.maxRetries} retries`);
        }
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
    const workDir = path.join("/tmp", `build-${jobData.deploymentId}`);

    fs.mkdirSync(workDir, { recursive: true });

    // On Vercel, prioritize archive download since git may not be available
    if (jobData.repoArchiveUrl) {
      try {
        await this.downloadAndExtractArchive(jobData, workDir);
        return workDir;
      } catch (error) {
        console.warn("Archive download failed:", error);

        // If archive fails, try alternative methods
        try {
          await this.downloadWithFetch(jobData, workDir);
          return workDir;
        } catch (fetchError) {
          console.warn("Fetch download failed:", fetchError);
          throw new Error(
            `Failed to download repository: ${error}. Archive URL may be invalid or repository may be private.`,
          );
        }
      }
    } else {
      // Fallback: try to use Node.js fetch for public repos
      try {
        await this.downloadWithFetch(jobData, workDir);
        return workDir;
      } catch (error) {
        throw new Error(
          `No archive URL provided and fetch failed: ${error}. Please ensure the repository is accessible.`,
        );
      }
    }
  }

  private async downloadAndExtractArchive(
    jobData: BuildJobData,
    workDir: string,
  ): Promise<void> {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const { FileHandler } = await import("./file-handler");

    const archivePath = path.join(
      "/tmp",
      `archive-${jobData.deploymentId}.tar.gz`,
    );

    // Use Node.js fetch instead of curl for better Vercel compatibility
    console.log(`Downloading archive from provided URL: ${jobData.repoArchiveUrl}`);
    console.log(`Using token: ${jobData.githubToken ? jobData.githubToken : 'NO TOKEN'}`);
    
    const response = await fetch(jobData.repoArchiveUrl!, {
      headers: {
        Authorization: `Bearer ${jobData.githubToken}`,
        "User-Agent": "tscircuit-deploy/1.0.0",
      },
    });

    if (!response.ok) {
      console.error(`Archive download failed: ${response.status} ${response.statusText}`);
      console.error(`URL: ${jobData.repoArchiveUrl}`);
      console.error(`Headers sent:`, {
        Authorization: `token ${jobData.githubToken ? jobData.githubToken : 'NO TOKEN'}`,
        "User-Agent": "tscircuit-deploy/1.0.0",
      });
      
      throw new Error(
        `Failed to download archive: ${response.status} ${response.statusText}. URL: ${jobData.repoArchiveUrl}`,
      );
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(archivePath, Buffer.from(buffer));

    const isValidSize = await FileHandler.validateFileSize(archivePath);
    if (!isValidSize) {
      throw new Error("Repository archive exceeds maximum file size limit");
    }

    await FileHandler.extractArchive(archivePath, workDir);

    // Handle GitHub archive structure (removes the top-level directory)
    const extractedDirs = fs.readdirSync(workDir);
    if (extractedDirs.length === 1) {
      const extractedDir = path.join(workDir, extractedDirs[0]);
      const tempDir = path.join("/tmp", `temp-${jobData.deploymentId}`);
      fs.renameSync(extractedDir, tempDir);
      fs.rmSync(workDir, { recursive: true });
      fs.renameSync(tempDir, workDir);
    }

    await FileHandler.cleanup([archivePath]);
  }

  private async downloadWithFetch(
    jobData: BuildJobData,
    workDir: string,
  ): Promise<void> {
    // This is a simpler fallback that downloads the archive directly
    const archiveUrl = `https://api.github.com/repos/${jobData.owner}/${jobData.repo}/tarball/${jobData.ref}`;
    
    console.log(`Attempting to download archive from: ${archiveUrl}`);
    console.log(`Using token: ${jobData.githubToken ? jobData.githubToken.substring(0, 8) + '...' : 'NO TOKEN'}`);
    
    const response = await fetch(archiveUrl, {
      headers: {
        Authorization: `Bearer ${jobData.githubToken}`,
        "User-Agent": "tscircuit-deploy/1.0.0",
      },
    });

    if (!response.ok) {
      console.error(`Archive download failed: ${response.status} ${response.statusText}`);
      console.error(`URL: ${archiveUrl}`);
      console.error(`Headers sent:`, {
        Authorization: `token ${jobData.githubToken ? jobData.githubToken.substring(0, 8) + '...' : 'NO TOKEN'}`,
        "User-Agent": "tscircuit-deploy/1.0.0",
      });
      
      throw new Error(
        `Failed to download repository: ${response.status} ${response.statusText}. URL: ${archiveUrl}`,
      );
    }

    await this.downloadAndExtractArchive(
      {
        ...jobData,
        repoArchiveUrl: archiveUrl,
      },
      workDir,
    );
  }

  private async buildProject(jobId: string, workingDirectory: string) {
    const processor = new SnapshotProcessor(
      workingDirectory,
      (progress: BuildProgress) => {
        const overallProgress = Math.round(progress.progress * 0.7 + 20);
        this.updateJobProgress(jobId, overallProgress, progress.message).catch(
          console.error,
        );
      },
    );

    return await processor.generateSnapshot();
  }

  private async finalizeBuild(
    job: BuildJob,
    jobData: BuildJobData,
    snapshot: any,
  ) {
    console.log(`Finalizing build for job: ${job.id}`);
    const userOctokit = new GitHubService({ token: jobData.githubToken });
    const botOctokit = new GitHubService({ token: env.GITHUB_BOT_TOKEN });

    const totalTime = Math.round(
      (Date.now() - new Date(job.startedAt!).getTime()) / 1000,
    );
    console.log(`Total build time: ${totalTime}s`);

    // Update deployment in database
    console.log(`Updating deployment in database for deployment ID: ${jobData.deploymentId}`);
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
      console.log(`Snapshot successful for deployment ID: ${jobData.deploymentId}`);
      // Update GitHub deployment status
      await userOctokit.createDeploymentStatus({
        owner: jobData.owner,
        repo: jobData.repo,
        deploymentId: jobData.deploymentId_github,
        state: "success",
        description: `Successfully built ${snapshot.circuitFiles.length} circuit${snapshot.circuitFiles.length === 1 ? "" : "s"} in ${totalTime}s`,
        logUrl: `${jobData.context.serverUrl}/${jobData.owner}/${jobData.repo}/actions/runs/${jobData.context.runId}`,
      });
      console.log(`GitHub deployment status updated for deployment ID: ${jobData.deploymentId_github}`);

      // Generate and post PR comment for pull requests
      if (jobData.eventType === "pull_request") {
        try {
          console.log(`Generating PR comment for deployment ID: ${jobData.deploymentId}`);
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
          console.log(`Updating check run for deployment ID: ${jobData.deploymentId}`);
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
          console.log(`Handling release creation for deployment ID: ${jobData.deploymentId}`);
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

  private async handleJobFailure(
    job: BuildJob,
    jobData: BuildJobData,
    errorMessage: string,
  ) {
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
      state: "failure",
      description: `Build failed: ${errorMessage}`,
      logUrl: `${jobData.context.serverUrl}/${jobData.owner}/${jobData.repo}/actions/runs/${jobData.context.runId}`,
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

        console.log(
          `Failure comment posted for deployment ${jobData.deploymentId}`,
        );
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

        console.log(
          `Check run updated with failure for deployment ${jobData.deploymentId}`,
        );
      } catch (error) {
        console.error("Failed to update check run with failure:", error);
      }
    }
  }

  private async updateJobProgress(
    jobId: string,
    progress: number,
    message: string,
  ) {
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
