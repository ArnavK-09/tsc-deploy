import { z } from "zod";
import { getGitHubService } from "./github.service";
import { db, deployments } from "@tscircuit-deploy/shared/db";
import { generatePRComment } from "../utils/pr-comment";
import { SnapshotResult } from "@tscircuit-deploy/shared/types";
import { DEPLOY_URL } from "../config/constants";

export const DeploymentRequestSchema = z.object({
  deploymentId: z.string(),
  owner: z.string(),
  repo: z.string(),
  ref: z.string(),
  environment: z.string(),
  eventType: z.enum(["pull_request", "push"]),
  pullRequest: z
    .object({
      number: z.number(),
      headSha: z.string(),
    })
    .optional(),
  context: z.object({
    serverUrl: z.string(),
    runId: z.string(),
  }),
  snapshotResult: z.any(),
  buildTime: z.number(),
  userToken: z.string().optional(),
});

export type DeploymentRequest = z.infer<typeof DeploymentRequestSchema>;

export class DeploymentService {
  async handlePullRequestDeployment(request: DeploymentRequest) {
    const githubService = getGitHubService();
    const previewUrl = `${DEPLOY_URL}/${request.deploymentId}`;

    if (!request.pullRequest) {
      throw new Error("Pull request data is required for PR deployments");
    }

    const deploymentPayload = {
      deploymentId: request.deploymentId,
      pullRequestNumber: request.pullRequest.number,
      circuitCount: request.snapshotResult.circuitFiles.length,
    };

    let deploymentStatusId: number | undefined;
    let checkRunId: number | undefined;

    try {
      const deploymentResult = await githubService.createDeployment({
        owner: request.owner,
        repo: request.repo,
        ref: request.pullRequest.headSha,
        environment: "preview",
        description: `Preview deployment for PR #${request.pullRequest.number}`,
        payload: deploymentPayload,
      });

      deploymentStatusId = deploymentResult.deploymentId;

      if (deploymentStatusId) {
        await githubService.createDeploymentStatus({
          owner: request.owner,
          repo: request.repo,
          deploymentId: deploymentStatusId,
          state: "in_progress",
          description: `Building preview deployment...`,
          logUrl: `${request.context.serverUrl}/${request.owner}/${request.repo}/actions/runs/${request.context.runId}`,
        });
      }

      const checkResult = await githubService.createCheckRun({
        owner: request.owner,
        repo: request.repo,
        name: "tscircuit deploy",
        headSha: request.pullRequest.headSha,
        status: "in_progress",
        detailsUrl: previewUrl,
        output: {
          title: "🔃 Building Preview Deploy",
          summary: `Found ${request.snapshotResult.circuitFiles.length} circuit file${request.snapshotResult.circuitFiles.length === 1 ? "" : "s"}. Starting build...`,
        },
      });

      checkRunId = checkResult.checkRunId;

      await this.saveDeploymentToDatabase({
        id: request.deploymentId,
        meta: JSON.stringify({
          type: "pull_request",
          pullRequest: request.pullRequest,
          deploymentStatusId,
          checkRunId,
        }),
        owner: request.owner,
        repo: request.repo,
        commitSha: request.pullRequest.headSha,
        buildLogs: "",
        errorMessage: "",
        metaType: "pull_request",
        buildTime: request.buildTime,
        snapshotResult: request.snapshotResult,
      });

      if (checkRunId) {
        await githubService.updateCheckRun({
          owner: request.owner,
          repo: request.repo,
          checkRunId,
          status: "completed",
          conclusion: "success",
          detailsUrl: previewUrl,
          output: {
            title: "✅ Preview Deploy Ready",
            summary: `Successfully built ${request.snapshotResult.circuitFiles.length} circuit${request.snapshotResult.circuitFiles.length === 1 ? "" : "s"} in ${request.buildTime}s`,
            text: `## 🔗 Preview URL\n${previewUrl}\n\n## 📊 Build Details\n- Circuits: ${request.snapshotResult.circuitFiles.length}\n- Build time: ${request.buildTime}s\n- Status: Ready`,
          },
        });
      }

      if (deploymentStatusId) {
        await githubService.createDeploymentStatus({
          owner: request.owner,
          repo: request.repo,
          deploymentId: deploymentStatusId,
          state: "success",
          description: `Preview deployment ready with ${request.snapshotResult.circuitFiles.length} circuit${request.snapshotResult.circuitFiles.length === 1 ? "" : "s"}`,
          environmentUrl: previewUrl,
          logUrl: `${request.context.serverUrl}/${request.owner}/${request.repo}/actions/runs/${request.context.runId}`,
        });
      }

      const comment = generatePRComment({
        deploymentId: request.deploymentId,
        previewUrl,
        buildTime: `${request.buildTime}`,
        circuitCount: request.snapshotResult.circuitFiles.length,
        status: "ready",
        commitSha: request.pullRequest.headSha,
        snapshotResult: request.snapshotResult,
      });

      await githubService.createPRComment({
        owner: request.owner,
        repo: request.repo,
        issueNumber: request.pullRequest.number,
        body: comment,
      });

      if (request.userToken) {
        await githubService.createPRCommentWithUserToken({
          owner: request.owner,
          repo: request.repo,
          issueNumber: request.pullRequest.number,
          body: comment,
          userToken: request.userToken,
        });
      }

      return {
        success: true,
        deploymentId: request.deploymentId,
        previewUrl,
        deploymentStatusId,
        checkRunId,
      };
    } catch (error) {
      if (checkRunId) {
        await githubService
          .updateCheckRun({
            owner: request.owner,
            repo: request.repo,
            checkRunId,
            status: "completed",
            conclusion: "failure",
            output: {
              title: "🔴 Build Failed",
              summary: `Build failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          })
          .catch(console.error);
      }

      if (deploymentStatusId) {
        await githubService
          .createDeploymentStatus({
            owner: request.owner,
            repo: request.repo,
            deploymentId: deploymentStatusId,
            state: "failure",
            description: `Build failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            logUrl: `${request.context.serverUrl}/${request.owner}/${request.repo}/actions/runs/${request.context.runId}`,
          })
          .catch(console.error);
      }

      throw error;
    }
  }

  async handlePushDeployment(request: DeploymentRequest) {
    const githubService = getGitHubService();
    const deploymentUrl = `${DEPLOY_URL}/${request.deploymentId}`;

    let deploymentStatusId: number | undefined;

    try {
      const deploymentResult = await githubService.createDeployment({
        owner: request.owner,
        repo: request.repo,
        ref: request.ref,
        environment: request.environment,
        description: `Deploy to ${request.environment} from ${request.ref}`,
        payload: {
          deploymentId: request.deploymentId,
          branch: request.ref,
          circuitCount: request.snapshotResult.circuitFiles.length,
        },
      });

      deploymentStatusId = deploymentResult.deploymentId;

      if (deploymentStatusId) {
        await githubService.createDeploymentStatus({
          owner: request.owner,
          repo: request.repo,
          deploymentId: deploymentStatusId,
          state: "in_progress",
          description: `Building ${request.environment} deployment...`,
          logUrl: `${request.context.serverUrl}/${request.owner}/${request.repo}/actions/runs/${request.context.runId}`,
        });
      }

      await this.saveDeploymentToDatabase({
        id: request.deploymentId,
        meta: JSON.stringify({
          type: "push",
          ref: request.ref,
          environment: request.environment,
          deploymentStatusId,
        }),
        owner: request.owner,
        repo: request.repo,
        commitSha: request.ref,
        buildLogs: "",
        errorMessage: "",
        metaType: "push",
        buildTime: request.buildTime,
        snapshotResult: request.snapshotResult,
      });

      if (deploymentStatusId) {
        await githubService.createDeploymentStatus({
          owner: request.owner,
          repo: request.repo,
          deploymentId: deploymentStatusId,
          state: "success",
          description: `${request.environment} deployment completed with ${request.snapshotResult.circuitFiles.length} circuit${request.snapshotResult.circuitFiles.length === 1 ? "" : "s"}`,
          environmentUrl: deploymentUrl,
          logUrl: `${request.context.serverUrl}/${request.owner}/${request.repo}/actions/runs/${request.context.runId}`,
        });
      }

      return {
        success: true,
        deploymentId: request.deploymentId,
        deploymentUrl,
        deploymentStatusId,
      };
    } catch (error) {
      if (deploymentStatusId) {
        await githubService
          .createDeploymentStatus({
            owner: request.owner,
            repo: request.repo,
            deploymentId: deploymentStatusId,
            state: "failure",
            description: `${request.environment} deployment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            logUrl: `${request.context.serverUrl}/${request.owner}/${request.repo}/actions/runs/${request.context.runId}`,
          })
          .catch(console.error);
      }

      throw error;
    }
  }

  private async saveDeploymentToDatabase(data: {
    id: string;
    meta: string;
    owner: string;
    repo: string;
    commitSha: string;
    buildLogs: string;
    errorMessage: string;
    metaType: "push" | "pull_request";
    buildTime: number;
    snapshotResult: SnapshotResult;
  }) {
    try {
      const result = await db.insert(deployments).values(data);
      return result;
    } catch (error) {
      console.error("Failed to save deployment to database:", error);
      throw error;
    }
  }
}

export const deploymentService = new DeploymentService();
