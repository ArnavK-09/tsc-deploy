import { BuildStatusSchema } from "../../../../shared/types";
import { JobQueue } from "../../../../utils/job-queue";
import { createErrorResponse, createSuccessResponse } from "@/utils/http";
import { extractGitHubToken } from "@/utils/auth";

export async function GET(context: { request: Request }) {
  const request = context.request;
  const token = extractGitHubToken(request);

  if (!token) {
    return createErrorResponse("Unauthorized - Bearer token required", 401);
  }

  try {
    const url = new URL(request.url);
    const jobId = url.searchParams.get("jobId");

    if (!jobId) {
      return createErrorResponse("jobId parameter is required", 400);
    }

    const jobQueue = JobQueue.getInstance();
    const job = await jobQueue.getBuildStatus(jobId);

    if (!job) {
      return createErrorResponse("Job not found", 404);
    }

    const queueLength = job.status === "queued" ? await jobQueue.getQueueLength() : undefined;

    const buildStatus = {
      jobId: job.id,
      status: job.status,
      progress: job.progress || 0,
      message: job.logs?.split('\n').pop()?.trim() || undefined,
      startedAt: job.startedAt?.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      errorMessage: job.errorMessage || undefined,
      estimatedDuration: job.estimatedDuration || undefined,
      queuePosition: queueLength,
    };

    return createSuccessResponse(buildStatus);

  } catch (error) {
    console.error("Error getting build status:", error);
    if (error instanceof Error) {
      return createErrorResponse(`Failed to get build status: ${error.message}`, 500);
    }
    return createErrorResponse("Internal server error", 500);
  }
} 