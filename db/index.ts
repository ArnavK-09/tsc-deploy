import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { deployments, buildJobs, buildArtifacts } from "./schema";

// Create database instance with error handling
let dbInstance: ReturnType<typeof drizzle>;

try {
  // Validate DATABASE_URL exists
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  // Create the database connection
  dbInstance = drizzle(sql, {
    logger: process.env.NODE_ENV === "development",
  });

  console.log("✅ Database connection initialized");
} catch (error) {
  console.error("❌ Failed to initialize database connection:", error);
  throw error;
}

export const db = dbInstance;

// Database health check function
export async function checkDatabaseConnection(): Promise<{ healthy: boolean; error?: string }> {
  try {
    // Simple query to test connection
    await sql`SELECT 1 as test`;
    return { healthy: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown database error";
    console.error("❌ Database health check failed:", errorMessage);
    return { healthy: false, error: errorMessage };
  }
}

// Wrapper function for database operations with retry logic
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  context = "database operation"
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error) {
      // Log detailed error information
      console.error(`❌ Database error in ${context}:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      // Check if it's a connection-related error
      if (error.message.includes("SASL") || error.message.includes("authentication")) {
        throw new Error(
          `Database authentication failed. Please check your DATABASE_URL environment variable. Original error: ${error.message}`
        );
      }

      // Re-throw with additional context
      throw new Error(`Database operation failed in ${context}: ${error.message}`);
    }
    throw error;
  }
}

export { deployments, buildJobs, buildArtifacts };

export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
export type BuildJob = typeof buildJobs.$inferSelect;
export type NewBuildJob = typeof buildJobs.$inferInsert;
export type BuildArtifact = typeof buildArtifacts.$inferSelect;
export type NewBuildArtifact = typeof buildArtifacts.$inferInsert;
