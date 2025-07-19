import {
  db,
  buildArtifacts,
  deployments,
  buildJobs,
} from "../../../../../../db";
import { eq } from "drizzle-orm";
import { createErrorResponse } from "@/utils/http";

export async function GET(context: {
  request: Request;
  params: { artifactId: string };
}) {
  const { artifactId } = context.params;

  try {
    const [result] = await db
      .select({
        artifact: buildArtifacts,
        deploymentId: buildJobs.deploymentId,
        snapshotResult: deployments.snapshotResult,
      })
      .from(buildArtifacts)
      .innerJoin(buildJobs, eq(buildArtifacts.jobId, buildJobs.id))
      .innerJoin(deployments, eq(buildJobs.deploymentId, deployments.id))
      .where(eq(buildArtifacts.id, artifactId))
      .limit(1);

    if (!result) {
      return createErrorResponse("Artifact not found", 404);
    }

    const { artifact, deploymentId, snapshotResult } = result;

    const snapshotData = snapshotResult as any;
    if (!snapshotData || !snapshotData.circuitFiles) {
      return createErrorResponse("Circuit data not found in deployment", 404);
    }

    const circuitFile = snapshotData.circuitFiles.find(
      (file: any) =>
        file.name === artifact.fileName || file.path === artifact.filePath,
    );

    if (!circuitFile || !circuitFile.circuitJson) {
      return createErrorResponse("Circuit JSON not found", 404);
    }

    const circuitJsonString = JSON.stringify(circuitFile.circuitJson, null, 2);

    return new Response(circuitJsonString, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${artifact.fileName}"`,
        "Content-Length": Buffer.byteLength(
          circuitJsonString,
          "utf8",
        ).toString(),
        "Cache-Control": "public, max-age=86400",
        "X-Artifact-Id": artifactId,
        "X-Deployment-Id": deploymentId,
        "X-Original-Path": artifact.filePath,
      },
    });
  } catch (error) {
    console.error(`Error downloading artifact ${artifactId}:`, error);

    if (error instanceof Error) {
      return createErrorResponse(
        `Failed to download artifact: ${error.message}`,
        500,
      );
    }

    return createErrorResponse(
      "Internal server error while downloading artifact",
      500,
    );
  }
}
