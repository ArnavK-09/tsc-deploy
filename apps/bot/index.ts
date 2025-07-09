import { Hono } from "hono";
import { GitHubAppService } from "./src/github-app.js";
import { WebhookHandlers } from "./src/webhook-handlers.js";
import { BuildService } from "./src/build-service.js";
import { RepositoryService } from "./src/repository-service.js";
import { version } from "../../package.json";

const app = new Hono();

const config = {
  appId: process.env.GITHUB_APP_ID! || "1546076",
  privateKey:
    process.env.GITHUB_PRIVATE_KEY! ||
    `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAvqIVMeHOySz2DRpa6ySW8wVd4k5xiEt5GYl6q5r8EWhp+HkP
03G+P3ryuued8e4GEYyKnEVzRVKqgb0nbZs6swvPRVVeCqs78Ps+8M5K4+znB5VM
hGE1N5Rp2E94brxFzjMHJIWvqML8Mx5Vy5rkEOne5Xg5eVb/WtkS45MtEBL9D/n6
zJo+4NLc/uuH3PrJC2dOYmXALVA+oaeerh3NR39MKvqo6srWxF7N0a+XDRQ4eVwQ
0jQkXA4+938ADieyRrUyN3A/o5/NFmM+nF/NPmVCRf2SOIxEzGbIwAxNETpM4bwg
Kj64xog77Agsb6CIufleeGPNUDrZUsCoHrEcuwIDAQABAoIBAQCbj9iL5CDCuhXv
i1o2GJ21ouOCEVFET5J67F1WPBsGeZZAVUo82czOMJ5zNx8ElaAOIgnajDIMl/Db
/md2Yf38rd5uTcN4IVPAysYJ683hQSkmXwcZ39l1iX72LaOxeaHdKnbhrtYxeSwk
6tRIWhVSWAa0au87vWqT0CBB5ZAYVHpo2pglMb/pj5tlrM7i6JXM0UFdtJOiVqs0
v255jVyPP/3bfPmJzgeqapvDatzEnsvfJjAB7uBWHlQo/PZ35MDNwLHLLbb0r/s8
Dn5DmZJEv3GGtRCsrQLCMG2pAqvATa/H34GxE9FrLEyi076ADQqd3jdRrqLTQoNB
HwH8o8FBAoGBAP4X9R2tFo0z8DTrWFPtBg6VFKJRHW7ti3iaYRictdKmfrCzStC1
J3DgBcfmm4vdIJLETqd/vljicSxhMYw7cZvfzPb6PiCzTboTSME5q7ZB/MczNg+y
b3qgK6aAW6vKQVC/5fx1cJrJPbN1qzzsE8+LBf1xyHaYRz5zd/DrIIzNAoGBAMAQ
PE9H1GUR8oZtrnJltvSk7p3nSHbSReo9JLt8AA5nuuLycjRQaIgzrvcRwzPlpJrN
luS0/2pCXFf6+VJUjZtPlBmi1Q32c+1ZX4YlIFvsqSszEYlU/c/h7I3F/OPlUHMW
UC1ajnWczKjJiYrlQsN4gsSN35i6woSuo5L1Ck+nAoGBAIZSeeSPPM22eDQxeYcc
VMherQLFqK6cas99pPiS11edZnnYviMosMnt04CCexXr9q0/k2jekeyBAFz6oGvG
fN9u5vZlAXTd9Kf6S8rBxvFZXtybSOfxZxdHFuw1DMD68Z5TY6wbFUTuP2zgNn7F
Og/MKYV6ogN3qqnr9qroUVO9AoGAKD4+pM4ELvlHu+sXdljhsPkuFl/zyxHcHGyb
Wb1ttZb+jbcHPvbqMD/EFXjfUex4RQd26o0SR42IE9c+joWw9i4CdiysP7S4La9g
WJdG5Hv+JlMZBZGNbRWFn18w0f+mj7bJLfefif1E1MkFzNik2JhTriOcCkB3qZ1+
ILi/ZFkCgYBi7NZmKsg/2ucwz1DlfSBatoNde7o0tKuHCfo8vwpGbmoR+GQ9T5iD
01bPmcniyTZAvrJl4ZmcfkpMUcFzYFS74KgymJnYA3QsOTo6KihR15Yii3a5BGtl
59Ew1jcLiewpqyF0+P0bF/reGx9V08u6c+l19qxEvV2zDKWWeRATzw==
-----END RSA PRIVATE KEY-----`.trim(),
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET! || "lolipoplagelu",
  clientId: process.env.GITHUB_CLIENT_ID || "Iv23liWFpUWWvgJz0qv7",
  clientSecret:
    process.env.GITHUB_CLIENT_SECRET ||
    "b36f3f64a82f21f19f855c77ee6bd92882a31ade",
};

if (!config.appId || !config.privateKey || !config.webhookSecret) {
  console.error("Missing required GitHub App configuration");
  // process.exit(1);
}

const githubApp = new GitHubAppService(config);
const buildService = new BuildService();
const repositoryService = new RepositoryService();
const webhookHandlers = new WebhookHandlers(
  githubApp,
  buildService,
  repositoryService,
);

app.get("/", (c) => {
  return c.json({
    name: "tscircuit Deploy Bot",
    version: version,
    status: "running",
    queueSize: buildService.getQueueSize(),
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

app.post("/webhooks/github", async (c) => {
  try {
    const signature = c.req.header("x-hub-signature-256");
    const eventType = c.req.header("x-github-event");
    const body = await c.req.text();

    if (!signature || !eventType) {
      console.error("Missing signature or event type");
      return c.json({ error: "Missing required headers" }, 400);
    }

    const isValid = await githubApp.verifyWebhook(signature, body);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return c.json({ error: "Invalid signature" }, 401);
    }

    const payload = JSON.parse(body);

    await webhookHandlers.logWebhookEvent(
      eventType,
      payload,
      payload.repository?.id,
    );

    console.log(`Received ${eventType} webhook`);

    switch (eventType) {
      case "installation":
        await webhookHandlers.handleInstallation(payload);
        break;

      case "installation_repositories":
        await webhookHandlers.handleInstallationRepositories(payload);
        break;

      case "pull_request":
        await webhookHandlers.handlePullRequest(payload);
        break;

      case "push":
        await webhookHandlers.handlePush(payload);
        break;

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    return c.json({ success: true, eventType });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return c.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

app.get("/api/repositories", async (c) => {
  try {
    const repositories = await repositoryService.getActiveRepositories();
    return c.json(repositories);
  } catch (error) {
    console.error("Failed to fetch repositories:", error);
    return c.json({ error: "Failed to fetch repositories" }, 500);
  }
});

app.get("/api/repositories/:id/deployments", async (c) => {
  try {
    const repositoryId = parseInt(c.req.param("id"));
    if (isNaN(repositoryId)) {
      return c.json({ error: "Invalid repository ID" }, 400);
    }

    return c.json({ message: "Deployments endpoint - not implemented yet" });
  } catch (error) {
    console.error("Failed to fetch deployments:", error);
    return c.json({ error: "Failed to fetch deployments" }, 500);
  }
});

app.post("/api/deployments/:id/redeploy", async (c) => {
  try {
    const deploymentId = c.req.param("id");

    return c.json({
      message: "Redeploy endpoint - not implemented yet",
      deploymentId,
    });
  } catch (error) {
    console.error("Failed to redeploy:", error);
    return c.json({ error: "Failed to redeploy" }, 500);
  }
});

app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
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

const port = parseInt(process.env.PORT || "3001");

console.log(`🤖 tscircuit Deploy Bot starting on port ${port}`);
console.log(`📊 Health check: http://localhost:${port}/health`);
console.log(`🔗 Webhook endpoint: http://localhost:${port}/webhooks/github`);

export default {
  port,
  fetch: app.fetch,
};
