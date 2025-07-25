import { prisma } from "../../../../prisma";
import { createErrorResponse, createSuccessResponse } from "@/utils/http";

export async function GET(context: { request: Request }) {
  try {
    const url = new URL(context.request.url);
    const deploymentId = url.searchParams.get("deploymentId");
    const jobId = url.searchParams.get("jobId");
    const artifactId = url.searchParams.get("artifactId");

    if (artifactId) {
      const artifact = await prisma.buildArtifact.findUnique({
        where: { id: artifactId },
      });

      if (!artifact) {
        return createErrorResponse("Artifact not found", 404);
      }

      return createSuccessResponse({ artifact });
    }

    if (deploymentId) {
      const job = await prisma.buildJob.findFirst({
        where: { deploymentId },
        select: { id: true },
      });

      if (!job) {
        return createErrorResponse("No build job found for deployment", 404);
      }

      const artifacts = await prisma.buildArtifact.findMany({
        where: { jobId: job.id },
      });

      return createSuccessResponse({
        deploymentId,
        jobId: job.id,
        artifacts,
        totalArtifacts: artifacts.length,
      });
    }

    if (jobId) {
      const artifacts = await prisma.buildArtifact.findMany({
        where: { jobId },
      });

      return createSuccessResponse({
        jobId,
        artifacts,
        totalArtifacts: artifacts.length,
      });
    }

    return createErrorResponse(
      "Either deploymentId, jobId, or artifactId parameter is required",
      400,
    );
  } catch (error) {
    console.error("Error fetching build artifacts:", error);
    if (error instanceof Error) {
      return createErrorResponse(
        `Failed to fetch artifacts: ${error.message}`,
        500,
      );
    }
    return createErrorResponse("Internal server error", 500);
  }
}
