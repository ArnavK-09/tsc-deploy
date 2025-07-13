import * as core from "@actions/core";
import * as github from "@actions/github";
import { z } from "zod";
import snapshotProject, { findCircuitFiles } from "./snapshot-project";
import { DEPLOY_URL, DEPLOY_SERVER_URL } from "../../shared/constants";
import { ulid } from "ulid";
import ky from "ky";
import { DeploymentRequest, SnapshotResult } from "../../shared/types";
import { GitHubService } from "../../shared/github.service";

const InputSchema = z.object({
  githubToken: z.string(),
  workingDirectory: z.string().default("."),
  deployServerUrl: z.string().default(DEPLOY_SERVER_URL).optional(),
  create_release: z.boolean().default(false).optional(),
});

export interface DeploymentResult {
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
      create_release: core.getInput("create-release") === "true",
    });

    const context = github.context;
    const userOctokit = new GitHubService({
      token: inputs.githubToken,
    });
    const ID = ulid();

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

    core.info(`📋 Found ${circuitFiles.length} circuit file(s), Building...\n`);
    const buildResult = await runTscircuitBuild(inputs, circuitFiles);
    const { deploymentId } = await userOctokit.createDeployment({
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
      description: `Deploy to ${context.eventName === "push" ? (context.ref === "refs/heads/main" || context.ref === "refs/heads/master" ? "production" : "staging") : "preview"} from ${context.sha}`,
      payload: {
        deploymentId: `deployment-${ID}`,
        pullRequestNumber:
          context.eventName === "pull_request"
            ? context.payload.pull_request?.number?.toString() || ""
            : context.sha,
        circuitCount: buildResult.snapshotResult.circuitFiles.length,
      },
    });

    let checkRunId: number | undefined;
    if (context.eventName == "pull_request") {
      const { checkRunId: checkRunIdCreated } =
        await userOctokit.createCheckRun({
          owner: context.repo.owner,
          repo: context.repo.repo,
          name: "tscircuit deploy",
          headSha: context.payload.pull_request?.head.sha || context.sha,
          status: "in_progress",
          detailsUrl: `${DEPLOY_URL}/deployments/${deploymentId}`,
          output: {
            title: "🔃 Building Preview Deploy",
            summary: `Found ${buildResult.snapshotResult.circuitFiles.length} circuit file${buildResult.snapshotResult.circuitFiles.length === 1 ? "" : "s"}. Starting build...`,
          },
        });

      checkRunId = checkRunIdCreated;
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    const deploymentRequest: DeploymentRequest = {
      id: ID,
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
      meta:
        context.eventName === "pull_request"
          ? context.payload.pull_request?.number?.toString() || ""
          : context.sha,
      context: {
        serverUrl: context.serverUrl,
        runId: context.runId.toString(),
        sha: context.payload.pull_request?.head.sha || context.sha,
        message: context.payload.head_commit?.message || "",
      },
      snapshotResult: buildResult.snapshotResult,
      buildTime: totalTime,
      deploymentId: Number(deploymentId),
      checkRunId: checkRunId,
      create_release:
      context.eventName == "push" && (inputs.create_release || false),
    };
    console.log({
      Authorization: `Bearer ${inputs.githubToken}`,
    })

    const response = await ky.post(
      `${inputs.deployServerUrl}/api/process`,
      {
        json: deploymentRequest,
        timeout: 60000,
        retry: {
          limit: 3,
          methods: ["post"],
        },
        headers: {
          Authorization: `Bearer ${inputs.githubToken}`,
        },throwHttpErrors: false
      },
    );

    if(!response.ok) {
      console.log(response)
      console.log(await response.text())
      throw new Error(response.statusText);
    }
    
    const result = await response.json<{
      success: boolean;
      previewUrl?: string;
      error?: string;
    }>();

    if (!result.success) {
      throw new Error(result.error || "Deployment processing failed");
    }

    const previewUrl = result.previewUrl;

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
    const errorMessage =
    error instanceof Error ? error.message : "Unknown error";
    core.error(error)
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
