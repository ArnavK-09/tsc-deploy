import { prisma } from "../../../../../prisma";
import { createErrorResponse } from "@/utils/http";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return createErrorResponse("Deployment ID is required", 400);
    }

    // Fetch deployment with all related data
    const deployment = await prisma.deployment.findUnique({
      where: { id },
      include: {
        buildJobs: {
          include: {
            buildArtifacts: true,
          },
          orderBy: { queuedAt: "desc" },
        },
        buildArtifacts: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!deployment) {
      return createErrorResponse("Deployment not found", 404);
    }

    // Transform the data for the frontend
    const transformedDeployment = {
      id: deployment.id,
      owner: deployment.owner,
      repo: deployment.repo,
      commitSha: deployment.commitSha,
      status: deployment.status || "pending",
      metaType: deployment.metaType,
      meta: deployment.meta,
      buildDuration: deployment.buildDuration,
      totalCircuitFiles: deployment.totalCircuitFiles || 0,
      createdAt: deployment.createdAt.toISOString(),
      buildCompletedAt: deployment.buildCompletedAt?.toISOString() || null,
      snapshotResult: deployment.snapshotResult,
      buildJobs: deployment.buildJobs.map((job) => ({
        id: job.id,
        status: job.status,
        priority: job.priority,
        startedAt: job.startedAt?.toISOString() || null,
        completedAt: job.completedAt?.toISOString() || null,
        retryCount: job.retryCount,
        errorMessage: job.errorMessage,
        queuedAt: job.queuedAt.toISOString(),
        progress: job.progress || 0,
        logs: job.logs,
        metadata: job.metadata,
        buildArtifacts: job.buildArtifacts.map((artifact) => ({
          id: artifact.id,
          fileName: artifact.fileName,
          filePath: artifact.filePath,
          fileSize: artifact.fileSize,
          createdAt: artifact.createdAt.toISOString(),
          circuitJson: artifact.circuitJson,
        })),
      })),
      buildArtifacts: deployment.buildArtifacts.map((artifact) => ({
        id: artifact.id,
        fileName: artifact.fileName,
        filePath: artifact.filePath,
        fileSize: artifact.fileSize,
        createdAt: artifact.createdAt.toISOString(),
        circuitJson: artifact.circuitJson,
        jobId: artifact.jobId,
      })),
    };

    return new Response(
      JSON.stringify({
        success: true,
        deployment: transformedDeployment,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error fetching deployment details:", error);
    if (error instanceof Error) {
      return createErrorResponse(
        `Failed to fetch deployment details: ${error.message}`,
        500,
      );
    }
    return createErrorResponse("Internal server error", 500);
  }
};
