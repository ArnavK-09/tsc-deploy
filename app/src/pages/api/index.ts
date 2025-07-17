import { createSuccessResponse, createErrorResponse } from "@/utils/http";
import { checkDatabaseConnection } from "../../../../db";

export async function GET() {
  try {
    // Check database connectivity
    const dbHealth = await checkDatabaseConnection();
    
    const healthData = {
      status: dbHealth.healthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        connected: dbHealth.healthy,
        error: dbHealth.error,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        databaseUrlHost: process.env.DATABASE_URL ? 
          new URL(process.env.DATABASE_URL).hostname : 
          "not configured",
      },
    };

    if (!dbHealth.healthy) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Service unhealthy - database connection failed",
          ...healthData,
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    return createSuccessResponse(healthData);
  } catch (error) {
    console.error("Health check error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Health check failed",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
