import { Hono } from "hono";
import { z } from "zod";
import { getGitHubService } from "../services/github.service";

const githubRouter = new Hono();

const CreateDeploymentSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  ref: z.string(),
  environment: z.string(),
  description: z.string(),
  payload: z.record(z.unknown()),
});

githubRouter.post("/deployments", async (c) => {
  try {
    const body = await c.req.json();
    const params = CreateDeploymentSchema.parse(body);
    const githubService = getGitHubService();
    const result = await githubService.createDeployment(params);
    return c.json(result);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      400,
    );
  }
});

const UpdateDeploymentStatusSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  deploymentId: z.number(),
  state: z.enum(["in_progress", "success", "failure"]),
  description: z.string(),
  environmentUrl: z.string().optional(),
  logUrl: z.string(),
});

githubRouter.post("/deployments/status", async (c) => {
  try {
    const body = await c.req.json();
    const params = UpdateDeploymentStatusSchema.parse(body);
    const githubService = getGitHubService();
    await githubService.createDeploymentStatus(params);
    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      400,
    );
  }
});

const CreateCheckRunSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  name: z.string(),
  headSha: z.string(),
  status: z.enum(["queued", "in_progress", "completed"]),
  detailsUrl: z.string().optional(),
  output: z.object({
    title: z.string(),
    summary: z.string(),
    text: z.string().optional(),
  }),
  conclusion: z
    .enum([
      "success",
      "failure",
      "neutral",
      "cancelled",
      "skipped",
      "timed_out",
    ])
    .optional(),
});

githubRouter.post("/checks", async (c) => {
  try {
    const body = await c.req.json();
    const params = CreateCheckRunSchema.parse(body);
    const githubService = getGitHubService();
    const result = await githubService.createCheckRun(params);
    return c.json(result);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      400,
    );
  }
});

const UpdateCheckRunSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  checkRunId: z.number(),
  status: z.enum(["queued", "in_progress", "completed"]),
  conclusion: z
    .enum([
      "success",
      "failure",
      "neutral",
      "cancelled",
      "skipped",
      "timed_out",
    ])
    .optional(),
  detailsUrl: z.string().optional(),
  output: z.object({
    title: z.string(),
    summary: z.string(),
    text: z.string().optional(),
  }),
});

githubRouter.put("/checks/:checkRunId", async (c) => {
  try {
    const body = await c.req.json();
    const checkRunId = parseInt(c.req.param("checkRunId"));
    const params = UpdateCheckRunSchema.parse({ ...body, checkRunId });
    const githubService = getGitHubService();
    await githubService.updateCheckRun(params);
    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      400,
    );
  }
});

const CreatePRCommentSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  issueNumber: z.number(),
  body: z.string(),
  userToken: z.string().optional(),
});

githubRouter.post("/comments", async (c) => {
  try {
    const body = await c.req.json();
    const params = CreatePRCommentSchema.parse(body);
    const githubService = getGitHubService();

    if (params.userToken) {
      await githubService.createPRCommentWithUserToken(params);
    } else {
      await githubService.createPRComment(params);
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      400,
    );
  }
});

export default githubRouter;
