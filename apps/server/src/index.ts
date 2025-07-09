import { Hono } from "hono";
import { version } from "../../../package.json";
import { db, deployments } from "@tscircuit-deploy/shared/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
const app = new Hono();

app.get("/", (c) => {
  return c.json({
    name: "tscircuit Deploy Bot",
    version: version,
    status: "running",
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

app.onError((err, c) => {
  return c.json(
    {
      error: "Internal server error",
      message: err.message,
    },
    500,
  );
});

const pushSchema = z.object({
  id: z.string(),
  meta: z.string(),
  owner: z.string(),
  repo: z.string(),
  commitSha: z.string(),
  buildLogs: z.string(),
  errorMessage: z.string(),
  metaType: z.enum(["push", "pull_request"]),
});

app.post("/deployments/create", async (c) => {
  const {
    id,
    meta,
    owner,
    repo,
    commitSha,
    buildLogs,
    errorMessage,
    metaType,
  } = pushSchema.parse(await c.req.json());
  type NewDeployment = typeof deployments.$inferInsert;
  const newDeployment: NewDeployment = {
    id,
    meta,
    owner,
    repo,
    commitSha,
    buildLogs,
    errorMessage,
    metaType,
  };

  const result = await db.insert(deployments).values(newDeployment);

  return c.json(result);
});

app.get("/deployments/:id", async (c) => {
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, c.req.param("id")),
  });

  return c.json(deployment);
});

const port = 3001;

console.log(`🤖 tscircuit Deploy Bot starting on port ${port}`);
console.log(`📊 Health check: http://localhost:${port}/health`);

export default {
  port,
  fetch: app.fetch,
};
