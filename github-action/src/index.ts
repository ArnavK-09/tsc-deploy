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
    core.info("🔍 Parsing inputs...");
    const inputs = InputSchema.parse({
      githubToken: core.getInput("github-token"),
      workingDirectory: core.getInput("working-directory"),
      deployServerUrl: core.getInput("deploy-server-url") || DEPLOY_SERVER_URL,
      create_release: core.getInput("create-release") === "true",
    });
    core.info("✅ Inputs parsed successfully.");

    core.info("🔍 Retrieving GitHub context...");
    const context = github.context;
    core.info("✅ GitHub context retrieved.");

    core.info("🔍 Initializing GitHub service...");
    const userOctokit = new GitHubService({
      token: inputs.githubToken,
    });
    core.info("✅ GitHub service initialized.");

    core.info("🔍 Generating unique deployment ID...");
    const ID = ulid();
    core.info(`✅ Deployment ID generated: ${ID}`);

    core.info(`\n🔌 Starting tscircuit Deploy`);
    core.info(`\tRepository: ${context.repo.owner}/${context.repo.repo}`);
    core.info(`\tEvent: ${context.eventName}`);
    core.info(`\tSHA: ${context.sha}`);

    const startTime = Date.now();
    core.info("⏱️ Start time recorded.");

    core.info("🔍 Finding circuit files...");
    const circuitFiles = await findCircuitFiles(inputs.workingDirectory);
    core.info(`✅ Found ${circuitFiles.length} circuit file(s).`);

    if (circuitFiles.length === 0) {
      core.warning("⚠️ No circuit files found");
      core.setOutput("deployment-id", "no-circuits");
      core.setOutput("circuit-count", "0");
      core.setOutput("status", "skipped");
      core.info("🚫 Deployment skipped due to no circuit files.");
      return;
    }

    core.info(`📋 Found ${circuitFiles.length} circuit file(s), Building...\n`);
    const buildResult = await runTscircuitBuild(inputs, circuitFiles);
    core.info("✅ Build completed.");

    core.info("🔍 Creating deployment...");
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
    core.info(`✅ Deployment created with ID: ${deploymentId}`);

    let checkRunId: number | undefined;
    if (context.eventName == "pull_request") {
      core.info("🔍 Creating check run for pull request...");
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
      core.info(`✅ Check run created with ID: ${checkRunId}`);
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);
    core.info(`⏱️ Total build time: ${totalTime}s`);

    core.info("🔍 Preparing deployment request...");
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
    core.info("✅ Deployment request prepared");
    const response4  = await fetch("https://example.com")
    console.log(await response4.text());
    console.log("deploymentRequest");
    const response2 = await fetch(
      `${inputs.deployServerUrl}/process`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          Authorization: `Bearer ${inputs.githubToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    core.info(await response2.text() +   ` ${inputs.deployServerUrl}/process`);
    core.info("Mock sent")
    process.exit(1);
    const response = await ky.post(
      `${inputs.deployServerUrl}/api/process`,
      {
        body: JSON.stringify(deploymentRequest),
        headers: {
          Authorization: `Bearer ${inputs.githubToken}`,
        }
      },
    );


    core.info("🔍 Sending deployment request...");
    core.info("✅ Deployment request sent.");

    if(!response.ok) {  
      core.error("❌ Deployment request failed.");
      console.log(response);
      console.log(await response.text());
      throw new Error(response.statusText);
    }
    
    core.info("🔍 Parsing deployment response...");
    const result = await response.json() as any;
    core.info("✅ Deployment response parsed.");

    if (!result.success) {
      core.error("❌ Deployment processing failed.");
      throw new Error(result.error || "Deployment processing failed");
    }

    const previewUrl = result.previewUrl;
    core.info("✅ Deployment processed successfully.");

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
    core.error(error as Error);
    core.setFailed(`☠️ Workflow failed: ${errorMessage}`);
    process.exit(1);
  }
}

async function runTscircuitBuild(
  inputs: z.infer<typeof InputSchema>,
  circuitFiles: string[],
): Promise<{ buildTime: number; snapshotResult: SnapshotResult }> {
  const startTime = Date.now();
  core.info("⏱️ Build start time recorded.");

  core.info("🔨 Running tscircuit build and snapshot generation...");
  core.info(
    `📋 Processing ${circuitFiles.length} circuit file(s): ${circuitFiles.join(", ")}`,
  );

  try {
    core.info("🔍 Generating snapshot...");
    const snapshotResult = await snapshotProject(inputs.workingDirectory);
    core.info("✅ Snapshot generated.");

    if (!snapshotResult.success) {
      core.error("❌ Snapshot generation failed.");
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
    core.info(`⏱️ Build time: ${buildTime}s`);

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
