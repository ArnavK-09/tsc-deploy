import { PrismaClient } from "../generated/prisma/client";

let prismaInstance: PrismaClient;

try {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  prismaInstance = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

  console.log("✅ Prisma client initialized");
} catch (error) {
  console.error("❌ Failed to initialize Prisma client:", error);
  throw error;
}

export const prisma = prismaInstance;

export async function checkDatabaseConnection(): Promise<{
  healthy: boolean;
  error?: string;
}> {
  try {
    await prisma.$queryRaw`SELECT 1 as test`;
    return { healthy: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown database error";
    console.error("❌ Database health check failed:", errorMessage);
    return { healthy: false, error: errorMessage };
  }
}

export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>,
  context = "database operation",
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Database error in ${context}:`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      if (
        error.message.includes("SASL") ||
        error.message.includes("authentication")
      ) {
        throw new Error(
          `Database authentication failed. Please check your DATABASE_URL environment variable. Original error: ${error.message}`,
        );
      }

      throw new Error(
        `Database operation failed in ${context}: ${error.message}`,
      );
    }
    throw error;
  }
}

// Graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
