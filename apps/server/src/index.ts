import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import {
  db,
  deployments,
  repositories,
  snapshots,
  buildArtifacts,
} from "@tscircuit-deploy/shared/db";
import { eq, desc, and } from "drizzle-orm";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: [
      "https://tscircuit.com",
      "https://preview.tscircuit.com",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.use("*", compress());

app.get("/", (c) => {
  return c.json({
    name: "tscircuit Deploy Server",
    version: "1.0.0",
    status: "running",
    environment: process.env.NODE_ENV || "development",
    endpoints: {
      health: "/health",
      deployment: "/api/deployments/:id",
      deploymentSnapshots: "/api/deployments/:id/snapshots",
      deploymentArtifacts: "/api/deployments/:id/artifacts",
      snapshot: "/api/deployments/:id/snapshots/:snapshotId",
      artifact: "/api/deployments/:id/artifacts/:artifactId",
      repositoryDeployments: "/api/repositories/:id/deployments",
      allRepositories: "/api/repositories",
      allDeployments: "/api/deployments",
    },
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: "connected",
  });
});

app.get("/api/deployments", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50");
    const offset = parseInt(c.req.query("offset") || "0");
    const status = c.req.query("status");
    const repositoryId = c.req.query("repository_id");

    // Build where conditions
    const conditions = [];
    if (status) {
      conditions.push(eq(deployments.status, status));
    }
    if (repositoryId) {
      const repoId = parseInt(repositoryId);
      if (!isNaN(repoId)) {
        conditions.push(eq(deployments.repositoryId, repoId));
      }
    }

    const deploymentList = await db
      .select({
        deployment: deployments,
        repository: repositories,
      })
      .from(deployments)
      .leftJoin(repositories, eq(deployments.repositoryId, repositories.id))
      .where(
        conditions.length > 0
          ? conditions.length === 1
            ? conditions[0]
            : and(...conditions)
          : undefined,
      )
      .orderBy(desc(deployments.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      deployments: deploymentList,
      pagination: {
        limit,
        offset,
        total: deploymentList.length,
        hasMore: deploymentList.length === limit,
      },
    });
  } catch (error) {
    console.error("Failed to fetch deployments:", error);
    return c.json({ error: "Failed to fetch deployments" }, 500);
  }
});

app.get("/api/repositories", async (c) => {
  try {
    const repositoryList = await db
      .select()
      .from(repositories)
      .where(eq(repositories.isActive, true))
      .orderBy(repositories.name);

    return c.json({
      repositories: repositoryList,
    });
  } catch (error) {
    console.error("Failed to fetch repositories:", error);
    return c.json({ error: "Failed to fetch repositories" }, 500);
  }
});

app.get("/api/deployments/:id", async (c) => {
  try {
    const deploymentId = c.req.param("id");

    const deployment = await db
      .select({
        deployment: deployments,
        repository: repositories,
      })
      .from(deployments)
      .leftJoin(repositories, eq(deployments.repositoryId, repositories.id))
      .where(eq(deployments.id, deploymentId))
      .limit(1);

    if (deployment.length === 0) {
      return c.json({ error: "Deployment not found" }, 404);
    }

    const [deploymentData] = deployment;

    const snapshotList = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.deploymentId, deploymentId))
      .orderBy(snapshots.createdAt);

    const artifactList = await db
      .select()
      .from(buildArtifacts)
      .where(eq(buildArtifacts.deploymentId, deploymentId))
      .orderBy(buildArtifacts.createdAt);

    return c.json({
      deployment: deploymentData.deployment,
      repository: deploymentData.repository,
      snapshots: snapshotList,
      artifacts: artifactList,
    });
  } catch (error) {
    console.error("Failed to fetch deployment:", error);
    return c.json({ error: "Failed to fetch deployment" }, 500);
  }
});

app.get("/api/deployments/:id/snapshots", async (c) => {
  try {
    const deploymentId = c.req.param("id");

    const snapshotList = await db
      .select()
      .from(snapshots)
      .where(eq(snapshots.deploymentId, deploymentId))
      .orderBy(snapshots.createdAt);

    return c.json({
      snapshots: snapshotList,
    });
  } catch (error) {
    console.error("Failed to fetch snapshots:", error);
    return c.json({ error: "Failed to fetch snapshots" }, 500);
  }
});

app.get("/api/deployments/:id/artifacts", async (c) => {
  try {
    const deploymentId = c.req.param("id");

    const artifactList = await db
      .select()
      .from(buildArtifacts)
      .where(eq(buildArtifacts.deploymentId, deploymentId))
      .orderBy(buildArtifacts.createdAt);

    return c.json({
      artifacts: artifactList,
    });
  } catch (error) {
    console.error("Failed to fetch artifacts:", error);
    return c.json({ error: "Failed to fetch artifacts" }, 500);
  }
});

app.get("/api/deployments/:id/snapshots/:snapshotId", async (c) => {
  try {
    const deploymentId = c.req.param("id");
    const snapshotId = c.req.param("snapshotId");

    const snapshot = await db
      .select()
      .from(snapshots)
      .where(
        and(
          eq(snapshots.deploymentId, deploymentId),
          eq(snapshots.id, snapshotId),
        ),
      )
      .limit(1);

    if (snapshot.length === 0) {
      return c.json({ error: "Snapshot not found" }, 404);
    }

    return c.json({
      snapshot: snapshot[0],
    });
  } catch (error) {
    console.error("Failed to fetch snapshot:", error);
    return c.json({ error: "Failed to fetch snapshot" }, 500);
  }
});

app.get("/api/deployments/:id/artifacts/:artifactId", async (c) => {
  try {
    const deploymentId = c.req.param("id");
    const artifactId = c.req.param("artifactId");

    const artifact = await db
      .select()
      .from(buildArtifacts)
      .where(
        and(
          eq(buildArtifacts.deploymentId, deploymentId),
          eq(buildArtifacts.id, artifactId),
        ),
      )
      .limit(1);

    if (artifact.length === 0) {
      return c.json({ error: "Artifact not found" }, 404);
    }

    const [artifactData] = artifact;

    if (artifactData.storageUrl) {
      return c.redirect(artifactData.storageUrl, 302);
    }

    return c.json({
      artifact: artifactData,
    });
  } catch (error) {
    console.error("Failed to fetch artifact:", error);
    return c.json({ error: "Failed to fetch artifact" }, 500);
  }
});

app.get("/api/repositories/:id/deployments", async (c) => {
  try {
    const repositoryId = parseInt(c.req.param("id"));
    if (isNaN(repositoryId)) {
      return c.json({ error: "Invalid repository ID" }, 400);
    }

    const limit = parseInt(c.req.query("limit") || "20");
    const offset = parseInt(c.req.query("offset") || "0");
    const status = c.req.query("status");

    const whereConditions = [eq(deployments.repositoryId, repositoryId)];

    if (status) {
      whereConditions.push(eq(deployments.status, status));
    }

    const deploymentList = await db
      .select()
      .from(deployments)
      .where(
        whereConditions.length === 1
          ? whereConditions[0]
          : and(...whereConditions),
      )
      .orderBy(desc(deployments.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      deployments: deploymentList,
      pagination: {
        limit,
        offset,
        total: deploymentList.length,
        hasMore: deploymentList.length === limit,
      },
    });
  } catch (error) {
    console.error("Failed to fetch deployments:", error);
    return c.json({ error: "Failed to fetch deployments" }, 500);
  }
});

app.get("/api/repositories/:id", async (c) => {
  try {
    const repositoryId = parseInt(c.req.param("id"));
    if (isNaN(repositoryId)) {
      return c.json({ error: "Invalid repository ID" }, 400);
    }

    const repository = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, repositoryId))
      .limit(1);

    if (repository.length === 0) {
      return c.json({ error: "Repository not found" }, 404);
    }

    return c.json({
      repository: repository[0],
    });
  } catch (error) {
    console.error("Failed to fetch repository:", error);
    return c.json({ error: "Failed to fetch repository" }, 500);
  }
});

app.get("/api/stats", async (c) => {
  try {
    const totalDeployments = await db.$count(deployments);
    const activeRepositories = await db.$count(
      repositories,
      eq(repositories.isActive, true),
    );

    const recentDeployments = await db
      .select()
      .from(deployments)
      .orderBy(desc(deployments.createdAt))
      .limit(5);

    const statusCounts = await db
      .select({
        status: deployments.status,
        count: db.$count(
          deployments,
          eq(deployments.status, deployments.status),
        ),
      })
      .from(deployments)
      .groupBy(deployments.status);

    return c.json({
      totalDeployments,
      activeRepositories,
      recentDeployments,
      statusCounts,
    });
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
});

app.notFound((c) => {
  return c.json(
    {
      error: "Not found",
      message: "The requested endpoint does not exist",
      availableEndpoints: [
        "GET /",
        "GET /health",
        "GET /api/deployments",
        "GET /api/repositories",
        "GET /api/deployments/:id",
        "GET /api/deployments/:id/snapshots",
        "GET /api/deployments/:id/artifacts",
        "GET /api/deployments/:id/snapshots/:snapshotId",
        "GET /api/deployments/:id/artifacts/:artifactId",
        "GET /api/repositories/:id/deployments",
        "GET /api/repositories/:id",
        "GET /api/stats",
      ],
    },
    404,
  );
});

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      error: "Internal server error",
      message: err.message,
    },
    500,
  );
});

const port = parseInt(process.env.PORT || "3000");

console.log(`🌐 tscircuit Deploy Server starting on port ${port}`);
console.log(`📊 Health check: http://localhost:${port}/health`);
console.log(`🔗 API endpoints: http://localhost:${port}/api`);

export default {
  port,
  fetch: app.fetch,
};
