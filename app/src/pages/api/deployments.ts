import { prisma } from "../../../../prisma";
import { createErrorResponse, createSuccessResponse } from "@/utils/http";
import type { DeploymentView } from "../../../../shared/types";

export async function GET(context: { request: Request }) {
  try {
    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = Math.min(
      parseInt(url.searchParams.get("limit") || "20", 10),
      100,
    );
    const owner = url.searchParams.get("owner");
    const repo = url.searchParams.get("repo");
    const status = url.searchParams.get("status");
    const id = url.searchParams.get("id");

    if (id) {
      const deployment = await prisma.deployment.findUnique({
        where: { id },
      });

      if (!deployment) {
        return createErrorResponse("Deployment not found", 404);
      }

      let artifactCount = 0;
      try {
        const job = await prisma.buildJob.findFirst({
          where: { deploymentId: id },
          select: { id: true },
        });

        if (job) {
          artifactCount = await prisma.buildArtifact.count({
            where: { jobId: job.id },
          });
        }
      } catch (error) {
        console.warn("Could not fetch artifact count:", error);
      }

      const deploymentView: DeploymentView = {
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
      };

      return createSuccessResponse({
        deployment: deploymentView,
        snapshotResult: deployment.snapshotResult,
        artifactCount,
        hasArtifacts: artifactCount > 0,
      });
    }

    const whereClause: any = {};
    if (owner) whereClause.owner = owner;
    if (repo) whereClause.repo = repo;
    if (status) whereClause.status = status;

    const allDeployments = await prisma.deployment.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    });

    const deploymentViews: DeploymentView[] = allDeployments.map(
      (deployment: any) => ({
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
      }),
    );

    const totalCount = await prisma.deployment.count({
      where: whereClause,
    });

    const totalPages = Math.ceil(totalCount / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    return createSuccessResponse({
      deployments: deploymentViews,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext,
        hasPrevious,
      },
      filters: {
        owner,
        repo,
        status,
      },
    });
  } catch (error) {
    console.error("Error fetching deployments:", error);
    if (error instanceof Error) {
      return createErrorResponse(
        `Failed to fetch deployments: ${error.message}`,
        500,
      );
    }
    return createErrorResponse("Internal server error", 500);
  }
}
