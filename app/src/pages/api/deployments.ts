import { db, deployments } from "../../../../db";
import { createSuccessResponse, createErrorResponse } from "@/utils/http";

export async function GET() {
  try {
    const result = await db.select().from(deployments);
    return createSuccessResponse({
      deployments: result,
    });
  } catch (error) {
    console.error("Error fetching deployments:", error);
    return createErrorResponse("Failed to fetch deployments", 500);
  }
}
