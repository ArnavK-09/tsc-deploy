import { SimpleBuildRequestSchema } from "../../../../shared/types";
import { db, deployments } from "../../../../db";
import type { NewDeployment } from "../../../../db";
import { GitHubService } from "../../../../shared/github.service";
import { JobQueue } from "../../../../utils/job-queue";
import type { BuildJobData } from "../../../../utils/job-queue";
import { createErrorResponse, createSuccessResponse } from "@/utils/http";
import { extractGitHubToken } from "@/utils/auth";
import { ulid } from "ulid";

import { initializeServices } from "../../../../utils/startup";

export async function POST(context: { request: Request }) {
  await initializeServices();
  
  const request = context.request;
  const token = extractGitHubToken(request);

  if (!token) {
    return createErrorResponse("Unauthorized - Bearer token required", 401);
  }

  try {
    const body = await request.json();
    const buildRequest = SimpleBuildRequestSchema.parse(body);

    const userOctokit = new GitHubService({ token });
    const jobQueue = JobQueue.getInstance();

    if (!["pull_request", "push"].includes(buildRequest.eventType)) {
      return createErrorResponse(
        `Invalid event type: ${buildRequest.eventType}`,
        400,
      );
    }

    const newDeployment: NewDeployment = {
      id: buildRequest.id,
      owner: buildRequest.owner,
      repo: buildRequest.repo,
      meta: buildRequest.meta,
      metaType: buildRequest.eventType as "push" | "pull_request",
      commitSha: buildRequest.ref,
      buildDuration: null,
      buildLogs: "",
      errorMessage: "",
      buildCompletedAt: null,
      snapshotResult: null,
      status: "pending",
    };

    await db.insert(deployments).values(newDeployment);

    const buildJobData: BuildJobData = {
      deploymentId: buildRequest.id,
      owner: buildRequest.owner,
      repo: buildRequest.repo,
      ref: buildRequest.ref,
      environment: buildRequest.environment,
      eventType: buildRequest.eventType,
      meta: buildRequest.meta,
      context: buildRequest.context,
      deploymentId_github: buildRequest.deploymentId,
      checkRunId: buildRequest.checkRunId,
      create_release: buildRequest.create_release,
      githubToken: token,
      repoArchiveUrl: buildRequest.repoArchiveUrl,
    };

    const priority = buildRequest.eventType === "pull_request" ? 1 : 0;
    const jobId = await jobQueue.queueBuild(buildJobData, priority);

    const queueLength = await jobQueue.getQueueLength();

    return createSuccessResponse({
      deploymentId: buildRequest.id,
      jobId,
      status: "queued",
      queuePosition: queueLength,
      message: "Build queued successfully",
    });

  } catch (error) {
    console.error("Error processing build request:", error);
    if (error instanceof Error) {
      return createErrorResponse(`Build request failed: ${error.message}`, 500);
    }
    return createErrorResponse("Internal server error", 500);
  }
} 