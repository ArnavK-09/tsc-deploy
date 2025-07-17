import { db, buildArtifacts, buildJobs, deployments } from "../../../../db";
import { eq, and } from "drizzle-orm";
import { createErrorResponse, createSuccessResponse } from "@/utils/http";

export async function GET(context: { request: Request }) {
  try {
    const url = new URL(context.request.url);
    const deploymentId = url.searchParams.get("deploymentId");
    const jobId = url.searchParams.get("jobId");
    const artifactId = url.searchParams.get("artifactId");
    const fileType = url.searchParams.get("fileType") || "circuit-json";

    // If specific artifact ID is requested
    if (artifactId) {
      const [artifact] = await db
        .select()
        .from(buildArtifacts)
        .where(eq(buildArtifacts.id, artifactId))
        .limit(1);

      if (!artifact) {
        return createErrorResponse("Artifact not found", 404);
      }

      return createSuccessResponse({ artifact });
    }

    // If deployment ID is provided, find the job first
    if (deploymentId) {
      const [job] = await db
        .select({ id: buildJobs.id })
        .from(buildJobs)
        .where(eq(buildJobs.deploymentId, deploymentId))
        .limit(1);

      if (!job) {
        return createErrorResponse("No build job found for deployment", 404);
      }

      const artifacts = await db
        .select()
        .from(buildArtifacts)
        .where(
          and(
            eq(buildArtifacts.jobId, job.id),
            eq(buildArtifacts.fileType, fileType)
          )
        );

      return createSuccessResponse({
        deploymentId,
        jobId: job.id,
        artifacts,
        totalArtifacts: artifacts.length,
      });
    }

    // If job ID is provided directly
    if (jobId) {
      const artifacts = await db
        .select()
        .from(buildArtifacts)
        .where(
          and(
            eq(buildArtifacts.jobId, jobId),
            eq(buildArtifacts.fileType, fileType)
          )
        );

      return createSuccessResponse({
        jobId,
        artifacts,
        totalArtifacts: artifacts.length,
      });
    }

    return createErrorResponse(
      "Either deploymentId, jobId, or artifactId parameter is required",
      400
    );
  } catch (error) {
    console.error("Error fetching build artifacts:", error);
    if (error instanceof Error) {
      return createErrorResponse(
        `Failed to fetch artifacts: ${error.message}`,
        500
      );
    }
    return createErrorResponse("Internal server error", 500);
  }
} 