import { prisma } from "../../../../../../prisma";
import { createErrorResponse } from "@/utils/http";

export async function GET(context: {
  request: Request;
  params: { artifactId: string };
}) {
  const { artifactId } = context.params;

  try {
    const result = await prisma.buildArtifact.findUnique({
      where: { id: artifactId },
      include: {
        job: {
          select: {
            deploymentId: true,
          },
        },
        deployment: {
          select: {
            snapshotResult: true,
          },
        },
      },
    });

    if (!result) {
      return createErrorResponse("Artifact not found", 404);
    }

    const artifact = result;
    const deploymentId = String(result.job?.deploymentId);
    const snapshotResult = result.deployment?.snapshotResult;

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
