import { db, deployments, buildJobs, buildArtifacts } from "../../../../db";
import { desc, eq, and, sql } from "drizzle-orm";
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
      const [deployment] = await db
        .select()
        .from(deployments)
        .where(eq(deployments.id, id))
        .limit(1);

      if (!deployment) {
        return createErrorResponse("Deployment not found", 404);
      }

      let artifactCount = 0;
      try {
        const [job] = await db
          .select({ id: buildJobs.id })
          .from(buildJobs)
          .where(eq(buildJobs.deploymentId, id))
          .limit(1);

        if (job) {
          const [{ count }] = await db
            .select({ count: sql<number>`cast(count(*) as integer)` })
            .from(buildArtifacts)
            .where(eq(buildArtifacts.jobId, job.id));

          artifactCount = count || 0;
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

    const conditions = [];
    if (owner) conditions.push(eq(deployments.owner, owner));
    if (repo) conditions.push(eq(deployments.repo, repo));
    if (status) conditions.push(eq(deployments.status, status as any));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const allDeployments = await db
      .select()
      .from(deployments)
      .where(whereClause)
      .orderBy(desc(deployments.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const deploymentViews: DeploymentView[] = allDeployments.map(
      (deployment) => ({
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

    const [{ count: totalCount }] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(deployments)
      .where(whereClause);

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
