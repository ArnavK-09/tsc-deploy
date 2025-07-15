import { DeploymentRequestSchema } from "@/utils/types";
import { db, deployments } from "@/utils/db";
import { GitHubService } from "@/utils/github-service";
import { DEPLOY_URL } from "@/utils/constants";
import { generatePRComment } from "@/utils/pr-comment";
import { env } from "@/utils/env";
import {
  validateGitHubToken,
} from "@/utils/auth";
import { createErrorResponse , createSuccessResponse} from "@/utils/http";

const botOctokit = new GitHubService({
  token: env.GITHUB_BOT_TOKEN,
});

export async function POST(context: { request: Request }) {
  const request = context.request;

  const authResult = await validateGitHubToken(request);
  if (!authResult.success) {
    return createErrorResponse(authResult.error!, 401);
  }

  try {
    const body = await request.json();
    const deploymentRequest = DeploymentRequestSchema.parse(body);

    const userOctokit = new GitHubService({
      token: authResult.token!,
    });

    const ID = deploymentRequest.id;

    if (["pull_request", "push"].includes(deploymentRequest.eventType)) {
      type NewDeploymentRequest = typeof deployments.$inferInsert;
      const newDeploymentRequest: NewDeploymentRequest = {
        id: ID,
        owner: deploymentRequest.owner,
        repo: deploymentRequest.repo,
        meta: deploymentRequest.meta,
        metaType: deploymentRequest.eventType as "push" | "pull_request",
        commitSha: deploymentRequest.ref,
        buildDuration: deploymentRequest.buildTime,
        buildLogs: "",
        errorMessage: "",
        buildCompletedAt: new Date(),
        snapshotResult: deploymentRequest.snapshotResult,
      };

      await db.insert(deployments).values(newDeploymentRequest);

      await userOctokit.createDeploymentStatus({
        owner: deploymentRequest.owner,
        repo: deploymentRequest.repo,
        deploymentId: deploymentRequest.deploymentId,
        state: "success",
        description: `Successfully built ${deploymentRequest.snapshotResult.circuitFiles.length} circuit${deploymentRequest.snapshotResult.circuitFiles.length === 1 ? "" : "s"} in ${deploymentRequest.buildTime}s`,
        logUrl: `${deploymentRequest.context.serverUrl}/${deploymentRequest.owner}/${deploymentRequest.repo}/actions/runs/${deploymentRequest.context.runId}`,
      });

      if (deploymentRequest.eventType === "pull_request") {
        const prComment = generatePRComment({
          deploymentId: ID,
          previewUrl: `${DEPLOY_URL}/deployments/${deploymentRequest.deploymentId}`,
          buildTime: `${deploymentRequest.buildTime}s`,
          circuitCount: deploymentRequest.snapshotResult.circuitFiles.length,
          status: "ready",
          snapshotResult: deploymentRequest.snapshotResult,
        });

        await botOctokit.createPRComment({
          owner: deploymentRequest.owner,
          repo: deploymentRequest.repo,
          issueNumber: Number(deploymentRequest.meta),
          body: prComment,
        });
      }

      if (deploymentRequest.eventType === "push") {
        const branch = deploymentRequest.ref.replace("refs/heads/", "");
        if (branch === "main" || branch === "master") {
          try {
            const { tag: lastTag } = await userOctokit.getLatestTag({
              owner: deploymentRequest.owner,
              repo: deploymentRequest.repo,
            });

            const commitMessage = deploymentRequest.context?.message || "";
            const packageVersion = userOctokit.generateNextVersion(
              lastTag,
              commitMessage,
            );

            const { tagSha } = await userOctokit.createTag({
              owner: deploymentRequest.owner,
              repo: deploymentRequest.repo,
              tag: `v${packageVersion}`,
              message: `Release v${packageVersion}`,
              object: deploymentRequest.ref.replace("refs/heads/", ""),
              type: "commit",
            });

            if (tagSha) {
              await userOctokit.createRef({
                owner: deploymentRequest.owner,
                repo: deploymentRequest.repo,
                ref: `refs/tags/v${packageVersion}`,
                sha: tagSha,
              });
            }
          } catch (error) {
            console.error("Error creating release:", error);
          }
        }
      }

      if (deploymentRequest.checkRunId) {
        await userOctokit.updateCheckRun({
          owner: deploymentRequest.owner,
          repo: deploymentRequest.repo,
          checkRunId: deploymentRequest.checkRunId,
          status: "completed",
          conclusion: "success",
          detailsUrl: `${DEPLOY_URL}/deployments/${deploymentRequest.deploymentId}`,
          output: {
            title: "✅ Preview Deploy Ready",
            summary: `Successfully built ${deploymentRequest.snapshotResult.circuitFiles.length} circuit${deploymentRequest.snapshotResult.circuitFiles.length === 1 ? "" : "s"} in ${deploymentRequest.buildTime}s`,
            text: `## 🔗 Preview URL\n${DEPLOY_URL}/deployments/${deploymentRequest.deploymentId}\n\n## 📊 Build Details\n- Circuits: ${deploymentRequest.snapshotResult.circuitFiles.length}\n- Build time: ${deploymentRequest.buildTime}s\n- Status: Ready`,
          },
        });
      }

      return createSuccessResponse({
        previewUrl: `${DEPLOY_URL}/deployments/${ID}`,
      });
    } else {
      return createErrorResponse("Invalid event type", 400);
    }
  } catch (error) {
    console.error("Error processing deployment request:", error);
    if (error instanceof Error) {
      return createErrorResponse(`Processing failed: ${error.message}`, 500);
    }
    return createErrorResponse("Internal server error", 500);
  }
}

export async function GET(context: { request: Request }) {
  return POST(context);
}

export async function PUT(context: { request: Request }) {
  return POST(context);
}

export async function PATCH(context: { request: Request }) {
  return POST(context);
}

export async function DELETE(context: { request: Request }) {
  return POST(context);
}
