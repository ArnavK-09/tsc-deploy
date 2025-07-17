import { createSuccessResponse } from "@/utils/http";

export async function GET() {
  return createSuccessResponse({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
}
