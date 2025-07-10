import * as core from "@actions/core";
import * as github from "@actions/github";
import { z } from "zod";
import snapshotProject, { findCircuitFiles } from "./snapshot-project";
import { DEPLOY_URL, DEPLOY_SERVER_URL } from "./constants";
import { ulid } from "ulid";
import ky from "ky";
import { SnapshotResult } from "@tscircuit-deploy/shared/types";

const InputSchema = z.object({
  githubToken: z.string(),
  workingDirectory: z.string().default("."),
  deployServerUrl: z.string().default(DEPLOY_SERVER_URL),
  apiSecret: z.string().optional(),
});

interface DeploymentResult {
  deploymentId: string;
  previewUrl?: string;
  packageVersion?: string;
  buildSnapshot: SnapshotResult | null;
  circuitCount: number;
  status: "skipped" | "ready" | "error" | "pending";
}

async function run(): Promise<void> {
  try {
    const inputs = InputSchema.parse({
      githubToken: core.getInput("github-token"),
      workingDirectory: core.getInput("working-directory"),
      deployServerUrl: core.getInput("deploy-server-url") || DEPLOY_SERVER_URL,
      apiSecret: core.getInput("api-secret"),
    });

    const context = github.context;

    core.info(`\n🔌 Starting tscircuit Deploy`);
    core.info(`\tRepository: ${context.repo.owner}/${context.repo.repo}`);
    core.info(`\tEvent: ${context.eventName}`);
    core.info(`\tSHA: ${context.sha}`);

    const startTime = Date.now();

    const circuitFiles = await findCircuitFiles(inputs.workingDirectory);

    if (circuitFiles.length === 0) {
      core.warning("⚠️ No circuit files found");
      core.setOutput("deployment-id", "no-circuits");
      core.setOutput("circuit-count", "0");
      core.setOutput("status", "skipped");
      return;
    }

    core.info(`📋 Found ${circuitFiles.length} circuit file(s)\n`);

    const deploymentId = `deployment-${ulid()}`;

    const buildResult = await runTscircuitBuild(inputs, circuitFiles);

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    const deploymentRequest = {
      deploymentId,
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: context.sha,
      environment:
        context.eventName === "push"
          ? context.ref === "refs/heads/main" ||
            context.ref === "refs/heads/master"
            ? "production"
            : "staging"
          : "preview",
      eventType: context.eventName,
      pullRequest:
        context.eventName === "pull_request" && context.payload.pull_request
          ? {
              number: context.payload.pull_request.number,
              headSha: context.payload.pull_request.head.sha,
            }
          : undefined,
      context: {
        serverUrl: context.serverUrl,
        runId: context.runId.toString(),
      },
      snapshotResult: buildResult.snapshotResult,
      buildTime: totalTime,
      userToken: inputs.githubToken,
    };

    try {
      const response = await ky.post(
        `${inputs.deployServerUrl}/deployments/process`,
        {
          json: deploymentRequest,
          timeout: 60000,
          retry: {
            limit: 3,
            methods: ["post"],
          },
          headers: inputs.apiSecret
            ? { Authorization: `Bearer ${inputs.apiSecret}` }
            : undefined,
        },
      );

      const result = await response.json<{
        success: boolean;
        deploymentId: string;
        previewUrl?: string;
        deploymentUrl?: string;
        error?: string;
      }>();

      if (!result.success) {
        throw new Error(result.error || "Deployment processing failed");
      }

      const previewUrl = result.previewUrl || result.deploymentUrl;

      core.setOutput("deployment-id", deploymentId);
      core.setOutput("build-time", totalTime.toString());
      core.setOutput("circuit-count", circuitFiles.length.toString());
      core.setOutput("status", "ready");

      if (previewUrl) {
        core.setOutput("preview-url", previewUrl);
      }

      core.info(`\n✅ Deployment completed successfully`);
      core.info(`🆔 Deployment ID: ${deploymentId}`);
      core.info(`⏱️ Total time: ${totalTime}s`);
      core.info(`📊 Circuits processed: ${circuitFiles.length}`);

      if (previewUrl) {
        core.info(`\n🔗 Preview URL: ${previewUrl}`);
      }
    } catch (error) {
      core.error(`Failed to process deployment on server: ${error}`);

      await ky.post(`${inputs.deployServerUrl}/deployments/create`, {
        json: {
          id: deploymentId,
          meta: JSON.stringify(context.payload),
          owner: context.repo.owner,
          repo: context.repo.repo,
          commitSha: context.sha,
          buildLogs: "",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          metaType: context.eventName,
          buildTime: totalTime,
          snapshotResult: buildResult.snapshotResult,
        },
        throwHttpErrors: false,
        headers: inputs.apiSecret
          ? { Authorization: `Bearer ${inputs.apiSecret}` }
          : undefined,
      });

      throw error;
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    core.setFailed(`☠️ Workflow failed: ${errorMessage}`);
    process.exit(1);
  }
}

async function runTscircuitBuild(
  inputs: z.infer<typeof InputSchema>,
  circuitFiles: string[],
): Promise<{ buildTime: number; snapshotResult: SnapshotResult }> {
  const startTime = Date.now();

  core.info("🔨 Running tscircuit build and snapshot generation...");
  core.info(
    `📋 Processing ${circuitFiles.length} circuit file(s): ${circuitFiles.join(", ")}`,
  );

  try {
    const snapshotResult = await snapshotProject(inputs.workingDirectory);

    if (!snapshotResult.success) {
      throw new Error(
        `Snapshot generation failed: ${snapshotResult.error || "Unknown error"}`,
      );
    }

    core.info(`✅ Snapshot generation completed:`);
    core.info(
      `   • Circuit files found: ${snapshotResult.circuitFiles.length}`,
    );
    core.info(`   • Build time: ${snapshotResult.buildTime}s`);

    const buildTime = Math.round((Date.now() - startTime) / 1000);

    return { buildTime, snapshotResult };
  } catch (error) {
    const buildTime = Math.round((Date.now() - startTime) / 1000);
    core.error(`❌ Build failed after ${buildTime}s`);
    throw new Error(
      `tscircuit build failed: ${error instanceof Error ? error.message : error}`,
    );
  }
}

run();
