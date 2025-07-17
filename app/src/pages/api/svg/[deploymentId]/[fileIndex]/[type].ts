import { db, deployments } from "../../../../../../../db";
import { eq } from "drizzle-orm";
import { SvgGenerator } from "../../../../../../../utils/svg-generator";
import type { SvgType } from "../../../../../../../utils/svg-generator";
import { createErrorResponse } from "@/utils/http";

export async function GET(context: {
  request: Request;
  params: { deploymentId: string; fileIndex: string; type: string };
}) {
  const { deploymentId, fileIndex, type } = context.params;
  const url = new URL(context.request.url);

  // Validate SVG type
  if (!["pcb", "schematic", "3d"].includes(type)) {
    return createErrorResponse(
      "Invalid SVG type. Must be pcb, schematic, or 3d",
      400,
    );
  }

  try {
    // Get deployment from database
    const [deployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, deploymentId))
      .limit(1);

    if (!deployment) {
      return createErrorResponse("Deployment not found", 404);
    }

    if (!deployment.snapshotResult) {
      return createErrorResponse(
        "No snapshot data available for this deployment",
        404,
      );
    }

    const snapshotData = deployment.snapshotResult as any;
    const fileIndexNum = parseInt(fileIndex, 10);

    if (
      isNaN(fileIndexNum) ||
      fileIndexNum < 0 ||
      fileIndexNum >= snapshotData.circuitFiles.length
    ) {
      return createErrorResponse("Invalid file index", 400);
    }

    const circuitFile = snapshotData.circuitFiles[fileIndexNum];
    if (!circuitFile || !circuitFile.circuitJson) {
      return createErrorResponse("Circuit JSON not found for this file", 404);
    }

    // Parse query parameters for customization
    const width = url.searchParams.get("width");
    const height = url.searchParams.get("height");
    const theme = url.searchParams.get("theme") as "light" | "dark" | null;

    const options = {
      type: type as SvgType,
      ...(width && { width: parseInt(width, 10) }),
      ...(height && { height: parseInt(height, 10) }),
      ...(theme && { theme }),
    };

    // Generate SVG
    const svgContent = await SvgGenerator.generateSvg(
      circuitFile.circuitJson,
      options,
    );

    // Return SVG with proper headers
    return new Response(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
        "Access-Control-Allow-Origin": "*",
        "X-Circuit-File": circuitFile.name,
        "X-SVG-Type": type,
      },
    });
  } catch (error) {
    console.error(
      `Error generating ${type} SVG for deployment ${deploymentId}:`,
      error,
    );

    if (error instanceof Error) {
      return createErrorResponse(
        `Failed to generate SVG: ${error.message}`,
        500,
      );
    }

    return createErrorResponse(
      "Internal server error while generating SVG",
      500,
    );
  }
}
