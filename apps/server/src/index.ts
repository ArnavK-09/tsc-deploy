import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { version } from "../../../package.json";
import { db, deployments } from "@tscircuit-deploy/shared/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "./config/env";
import { initializeGitHubService } from "./services/github.service";
import {
  deploymentService,
  DeploymentRequestSchema,
} from "./services/deployment.service";
import githubRouter from "./routes/github.routes";
import { apiAuth } from "./middleware/auth";

const app = new Hono();

app.use("*", cors());
app.use("*", logger());

initializeGitHubService({
  botToken: env.GITHUB_BOT_TOKEN,
  appToken: env.GITHUB_APP_TOKEN,
});

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

app.use("/api/github/*", apiAuth);
app.route("/api/github", githubRouter);

app.use("/deployments/*", apiAuth);

const createDeploymentSchema = z.object({
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
  } = createDeploymentSchema.parse(await c.req.json());
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

app.post("/deployments/process", async (c) => {
  try {
    const body = await c.req.json();
    const request = DeploymentRequestSchema.parse(body);

    let result;
    if (request.eventType === "pull_request") {
      result = await deploymentService.handlePullRequestDeployment(request);
    } else if (request.eventType === "push") {
      result = await deploymentService.handlePushDeployment(request);
    } else {
      throw new Error(`Unsupported event type: ${request.eventType}`);
    }

    return c.json(result);
  } catch (error) {
    console.error("Deployment processing error:", error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      400,
    );
  }
});

app.get("/deployments/:id", async (c) => {
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, c.req.param("id")),
  });

  return c.json(deployment);
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

const port = env.PORT;

console.log(`🤖 tscircuit Deploy Bot starting on port ${port}`);
console.log(`📊 Health check: http://localhost:${port}/health`);

export default {
  port,
  fetch: app.fetch,
};
