import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { version } from "../../../package.json";
import { env } from "@tscircuit-deploy/shared/constants";
import { GitHubService } from "@tscircuit-deploy/shared/services";
import { apiAuth } from "./middleware/github-token-expected";
import apiRouter from "./routes/api.routes";

const port = 3000;
export const app = new Hono();

export const botOctokit = new GitHubService({
  token: env.GITHUB_BOT_TOKEN,
});

app.use("*", cors());
app.use("*", logger());

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

app.use("/*", apiAuth);
app.route("/", apiRouter);

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

console.log(`🤖 tscircuit Deploy Bot starting on port ${port}`);
console.log(`📊 Health check: http://localhost:${port}/health`);

export default {
  port,
  fetch: app.fetch,
};
