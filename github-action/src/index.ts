import * as core from "@actions/core";
import * as github from "@actions/github";
import { z } from "zod";
import { DEPLOY_URL, DEPLOY_SERVER_URL } from "../../shared/constants";
import { ulid } from "ulid";
import ky from "ky";
import { SimpleBuildRequest, BuildStatus } from "../../shared/types";
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
  jobId: string;
  circuitCount: number;
  status: "skipped" | "ready" | "error" | "pending" | "queued";
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

    // Validate that this is a supported event
    const EVENT_TYPE = context.eventName == "workflow_dispatch" ? "push" : context.eventName;
    if (!["push", "pull_request"].includes(EVENT_TYPE)) {
      core.warning(`⚠️ Unsupported event type: ${EVENT_TYPE}`);
      core.setOutput("status", "skipped");
      return;
    }

    core.info("🔍 Creating deployment...");


    const { deploymentId } = await userOctokit.createDeployment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: context.sha,
      environment:
        EVENT_TYPE === "push"
          ? context.ref === "refs/heads/main" ||
            context.ref === "refs/heads/master"
            ? "production"
            : "staging"
          : "preview",
      description: `Deploy to ${EVENT_TYPE === "push" ? (context.ref === "refs/heads/main" || context.ref === "refs/heads/master" ? "production" : "staging") : "preview"} from ${context.sha}`,
      payload: {
        deploymentId: `deployment-${ID}`,
        pullRequestNumber:
          EVENT_TYPE === "pull_request"
            ? context.payload.pull_request?.number?.toString() || ""
            : context.sha,
      },
    });
    core.info(`✅ Deployment created with ID: ${deploymentId}`);

    let checkRunId: number | undefined;
    if (EVENT_TYPE === "pull_request") {
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
            title: "🔃 Queuing Build",
            summary: `Build queued for processing. Circuit detection and snapshot generation will be performed on the backend.`,
          },
        });
      checkRunId = checkRunIdCreated;
      core.info(`✅ Check run created with ID: ${checkRunId}`);
    }

    core.info("🔍 Preparing build request...");

    // Create archive URL for faster download
    const ref = EVENT_TYPE === "pull_request" ? `refs/pull/${context.payload.pull_request?.number}/head` : context.sha;
    const repoArchiveUrl = `https://api.github.com/repos/${context.repo.owner}/${context.repo.repo}/tarball/${ref}`;

    const buildRequest: SimpleBuildRequest = {
      id: ID,
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: context.sha,
      environment:
        EVENT_TYPE === "push"
          ? context.ref === "refs/heads/main" ||
            context.ref === "refs/heads/master"
            ? "production"
            : "staging"
          : "preview",
      eventType: EVENT_TYPE,
      meta:
        EVENT_TYPE === "pull_request"
          ? context.payload.pull_request?.number?.toString() || ""
          : context.sha,
      context: {
        serverUrl: context.serverUrl,
        runId: context.runId.toString(),
        sha: context.payload.pull_request?.head.sha || context.sha,
        message: context.payload.head_commit?.message || "",
      },
      deploymentId: Number(deploymentId),
      checkRunId: checkRunId,
      create_release:
        EVENT_TYPE === "push" && (inputs.create_release || false),
      repoArchiveUrl,
    };
    core.info("✅ Build request prepared");

    core.info("🔍 Sending build request...");
    const serverUrl = inputs.deployServerUrl || DEPLOY_SERVER_URL;

    const response = await ky.post(`${serverUrl}/api/build`, {
      body: JSON.stringify(buildRequest),
      headers: {
        Authorization: `Bearer ${inputs.githubToken}`,
        "Content-Type": "application/json",
      },
      timeout: 30000, // 30 second timeout
      throwHttpErrors: false,
    });

    if (!response.ok) {
      const errorText = await response.text();
      core.error("❌ Build request failed.");
      core.error(`Response status: ${response.status}`);
      core.error(`Response body: ${errorText}`);
      throw new Error(`Build request failed: ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as any;
    core.info("✅ Build request sent successfully.");

    if (!result.success) {
      core.error("❌ Build request processing failed.");
      throw new Error(result.error || "Build request processing failed");
    }

    const jobId: string = result.jobId;
    const queuePosition = result.queuePosition || 0;

    if (!jobId) {
      throw new Error("No job ID returned from build request");
    }

    core.info(`✅ Build queued successfully`);
    core.info(`🆔 Job ID: ${jobId}`);
    core.info(`📍 Queue position: ${queuePosition}`);

    // Monitor build progress
    const buildResult = await waitForBuildCompletion(
      serverUrl,
      inputs.githubToken,
      jobId,
    );

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    core.setOutput("deployment-id", deploymentId);
    core.setOutput("job-id", jobId);
    core.setOutput("build-time", totalTime.toString());
    core.setOutput("status", buildResult.status);
    core.setOutput(
      "circuit-count",
      buildResult.circuitCount?.toString() || "0",
    );

    const previewUrl = `${DEPLOY_URL}/deployments/${deploymentId}`;
    core.setOutput("preview-url", previewUrl);

    core.info(`\n✅ Build ${buildResult.status}`);
    core.info(`🆔 Deployment ID: ${deploymentId}`);
    core.info(`🔗 Job ID: ${jobId}`);
    core.info(`⏱️ Total time: ${totalTime}s`);
    core.info(`🔗 Preview URL: ${previewUrl}`);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    core.error(error as Error);
    core.setFailed(`☠️ Workflow failed: ${errorMessage}`);
    process.exit(1);
  }
}

async function waitForBuildCompletion(
  serverUrl: string,
  token: string,
  jobId: string,
): Promise<{ status: string; circuitCount?: number }> {
  core.info("⏳ Monitoring build progress...");

  const maxWaitTime = 20 * 60 * 1000; // 20 minutes
  const startTime = Date.now();
  const pollInterval = 10000; // 10 seconds
  let lastProgress = 0;

  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await ky.get(
        `${serverUrl}/api/build-status?jobId=${jobId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          timeout: 10000,
          throwHttpErrors: false,
        },
      );

      if (response.ok) {
        const result = (await response.json()) as any;
        const status: BuildStatus = result;

        core.info(JSON.stringify(status, null, 2));

        // Only log progress updates to avoid spam
        if (status.progress !== lastProgress) {
          core.info(`📊 Build status: ${status.status} (${status.progress}%)`);
          lastProgress = status.progress;
        }

        if (status.message && status.progress % 25 === 0) {
          core.info(`💬 ${status.message}`);
        }

        if (status.status === "completed") {
          core.info("✅ Build completed successfully!");

          // Try to get circuit count from deployment
          try {
            const deploymentResponse = await ky.get(
              `${serverUrl}/api/deployments?id=${jobId}`,
              {
                headers: { Authorization: `Bearer ${token}` },
                throwHttpErrors: false,
              },
            );

            if (deploymentResponse.ok) {
              const deploymentResult = (await deploymentResponse.json()) as any;
              return {
                status: "completed",
                circuitCount: deploymentResult.circuitCount || 0,
              };
            }
          } catch (e) {
            core.warning("Could not fetch circuit count");
          }

          return { status: "completed" };
        }

        if (status.status === "failed") {
          throw new Error(
            `Build failed: ${status.errorMessage || "Unknown error"}`,
          );
        }

        if (status.status === "cancelled") {
          throw new Error("Build was cancelled");
        }
      } else {
        throw new Error(`Build failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Build failed: ${error}`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  core.warning("⚠️ Build monitoring timed out after 20 minutes");
  return { status: "timeout" };
}

run();
