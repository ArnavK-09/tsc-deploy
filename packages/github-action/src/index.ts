import * as core from "@actions/core";
import * as github from "@actions/github";
import { z } from "zod";
import {
  snapshotProject,
  getSvgPreviews,
  getPngPreviews,
} from "./snapshot-project";
import fs from "node:fs";
import { DEPLOY_URL } from "./constants";
import { ulid } from "ulid";

const InputSchema = z.object({
  githubToken: z.string(),
  workingDirectory: z.string().default("."),
});
interface DeploymentResult {
  deploymentId: string;
  previewUrl?: string;
  packageVersion?: string;
  buildTime: number;
  circuitCount: number;
  status: "skipped" | "ready" | "error";
}

async function run(): Promise<void> {
  try {
    const inputs = InputSchema.parse({
      githubToken: core.getInput("github-token"),
      workingDirectory: core.getInput("working-directory"),
    });

    const context = github.context;
    const octokit = github.getOctokit(inputs.githubToken);

    core.info(`\n🔌 Starting tscircuit Deploy`);
    core.info(`\tRepository: ${context.repo.owner}/${context.repo.repo}`);
    core.info(`\tEvent: ${context.eventName}`);
    core.info(`\tSHA: ${context.sha}`);

    const startTime = Date.now();

    let deploymentResult: DeploymentResult;

    switch (context.eventName) {
      case "pull_request":
        deploymentResult = await handlePullRequest(inputs, context, octokit);
        break;

      case "push":
        deploymentResult = await handlePush(inputs, context, octokit);
        break;

      default:
        throw new Error(`Unsupported event type: ${context.eventName}`);
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    core.setOutput("deployment-id", deploymentResult.deploymentId);
    core.setOutput("build-time", totalTime.toString());
    core.setOutput("circuit-count", deploymentResult.circuitCount.toString());

    if (deploymentResult.previewUrl) {
      core.setOutput("preview-url", deploymentResult.previewUrl);
    }

    if (deploymentResult.packageVersion) {
      core.setOutput("package-version", deploymentResult.packageVersion);
    }

    if (deploymentResult.status === "skipped") {
      core.warning(`\n⚠️ No deployment was created`);
      return;
    }

    core.info(`\n✅ Deployment completed successfully`);
    core.info(`🆔 Deployment ID: ${deploymentResult.deploymentId}`);
    core.info(`⏱️ Total time: ${totalTime}s`);
    core.info(`📊 Circuits processed: ${deploymentResult.circuitCount}`);

    if (deploymentResult.previewUrl) {
      core.info(`\n🔗 Preview URL: ${deploymentResult.previewUrl}`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    core.setFailed(`☠️ Workflow failed: ${errorMessage}`);
    process.exit(1);
  }
}

async function handlePullRequest(
  inputs: z.infer<typeof InputSchema>,
  context: typeof github.context,
  octokit: ReturnType<typeof github.getOctokit>,
): Promise<DeploymentResult> {
  core.info(
    `\n🔄 Processing pull request #${context.payload.pull_request?.number}`,
  );

  const pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    throw new Error("Pull request data not available");
  }

  const circuitFiles = await findCircuitFiles(inputs.workingDirectory);

  if (circuitFiles.length === 0) {
    core.warning("⚠️ No circuit files found");
    return {
      deploymentId: "no-circuits",
      buildTime: 0,
      circuitCount: 0,
      status: "skipped",
    };
  }

  core.info(`📋 Found ${circuitFiles.length} circuit file(s)\n`);

  const deploymentId = `deployment-${ulid()}`;
  const previewUrl = `${DEPLOY_URL}/${deploymentId}`;

  let deploymentStatusId: number | undefined;

  try {
    deploymentStatusId = await createGitHubDeployment(
      octokit,
      context,
      "preview",
      pullRequest.head.sha,
      `Preview deployment for PR #${pullRequest.number}`,
      {
        deploymentId,
        pullRequestNumber: pullRequest.number,
        circuitCount: circuitFiles.length,
      },
    );

    if (deploymentStatusId) {
      core.info(`✅ Created GitHub deployment: ${deploymentStatusId}`);
    } else {
      core.warning(
        "\n⚠️ Failed to create GitHub deployment - continuing without deployment tracking",
      );
    }
  } catch (error) {
    core.warning(
      `⚠️ GitHub deployment creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    core.warning(
      "Continuing without deployment tracking - this may be due to insufficient permissions",
    );
    deploymentStatusId = undefined;
  }

  // Create check run (optional - may fail due to permissions)
  let checkRunId: number | undefined;

  try {
    const checkRun = await octokit.rest.checks.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      name: "tscircuit deploy",
      head_sha: pullRequest.head.sha,
      status: "in_progress",
      details_url: previewUrl,
      output: {
        title: "🔃 Building Preview Deploy",
        summary: `Found ${circuitFiles.length} circuit file${circuitFiles.length === 1 ? "" : "s"}. Starting build...`,
      },
    });

    checkRunId = checkRun.data.id;
    core.info(`✅ Created check run: ${checkRunId}`);
  } catch (error) {
    core.warning(
      `⚠️ Check run creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    core.warning(
      "Continuing without check run - this may be due to insufficient permissions",
    );
    checkRunId = undefined;
  }

  try {
    const buildResult = await runTscircuitBuild(inputs, circuitFiles);

    // Update check run on success (if we created one)
    if (checkRunId) {
      try {
        await octokit.rest.checks.update({
          owner: context.repo.owner,
          repo: context.repo.repo,
          check_run_id: checkRunId,
          status: "completed",
          conclusion: "success",
          details_url: previewUrl,
          output: {
            title: "Preview Deploy Ready",
            summary: `✅ Successfully built ${circuitFiles.length} circuit${circuitFiles.length === 1 ? "" : "s"} in ${buildResult.buildTime}s`,
            text: `## 🔗 Preview URL\n${previewUrl}\n\n## 📊 Build Details\n- Circuits: ${circuitFiles.length}\n- Build time: ${buildResult.buildTime}s\n- Status: Ready`,
          },
        });
      } catch (error) {
        core.warning(`⚠️ Failed to update check run: ${error}`);
      }
    }

    // Update deployment status to success
    if (deploymentStatusId) {
      try {
        await updateDeploymentStatus(
          octokit,
          context,
          deploymentStatusId,
          "success",
          `Preview deployment ready with ${circuitFiles.length} circuit${circuitFiles.length === 1 ? "" : "s"}`,
          previewUrl,
        );
        core.info(`✅ Updated deployment status to success`);
      } catch (error) {
        core.warning(`⚠️ Failed to update deployment status: ${error}`);
      }
    }

    // Get SVG and PNG previews if snapshot result is available
    const svgPreviews = buildResult.snapshotResult
      ? await getSvgPreviews(buildResult.snapshotResult)
      : undefined;
    const pngPreviews = buildResult.snapshotResult
      ? await getPngPreviews(buildResult.snapshotResult)
      : undefined;

    const comment = createPRComment({
      deploymentId,
      previewUrl,
      buildTime: `${buildResult.buildTime}s`,
      circuitCount: circuitFiles.length,
      status: "ready",
      commitSha: pullRequest.head.sha,
      svgPreviews,
      pngPreviews,
    });

    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pullRequest.number,
      body: comment,
    });

    return {
      deploymentId,
      previewUrl,
      buildTime: buildResult.buildTime,
      circuitCount: circuitFiles.length,
      status: "ready",
    };
  } catch (error) {
    // Update check run on failure (if we created one)
    if (checkRunId) {
      try {
        await octokit.rest.checks.update({
          owner: context.repo.owner,
          repo: context.repo.repo,
          check_run_id: checkRunId,
          status: "completed",
          conclusion: "failure",
          output: {
            title: "Build Failed",
            summary: `❌ Build failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        });
      } catch (checkError) {
        core.warning(`⚠️ Failed to update check run: ${checkError}`);
      }
    }

    // Update deployment status to failure
    if (deploymentStatusId) {
      try {
        await updateDeploymentStatus(
          octokit,
          context,
          deploymentStatusId,
          "failure",
          `Build failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        core.info(`✅ Updated deployment status to failure`);
      } catch (deployError) {
        core.warning(`⚠️ Failed to update deployment status: ${deployError}`);
      }
    }

    throw error;
  }
}

async function handlePush(
  inputs: z.infer<typeof InputSchema>,
  context: typeof github.context,
  octokit: ReturnType<typeof github.getOctokit>,
): Promise<DeploymentResult> {
  const ref = context.ref;
  const branch = ref.replace("refs/heads/", "");

  core.info(`📤 Processing push to ${branch}`);

  const circuitFiles = await findCircuitFiles(inputs.workingDirectory);
  console.log(circuitFiles);
  if (circuitFiles.length === 0) {
    core.warning("⚠️ No circuit files found - skipping deployment");
    return {
      deploymentId: "no-circuits",
      buildTime: 0,
      circuitCount: 0,
      status: "skipped",
    };
  }

  const deploymentId = `deployment-${ulid()}`;
  const environment =
    branch === "main" || branch === "master" ? "production" : "staging";

  // Create GitHub deployment for push events (optional - may fail due to permissions)
  let deploymentStatusId: number | undefined;

  try {
    deploymentStatusId = await createGitHubDeployment(
      octokit,
      context,
      environment,
      context.sha,
      `Deploy to ${environment} from ${branch}`,
      {
        deploymentId,
        branch,
        circuitCount: circuitFiles.length,
      },
    );

    if (deploymentStatusId) {
      core.info(`✅ Created GitHub deployment: ${deploymentStatusId}`);
    } else {
      core.warning(
        "⚠️ Failed to create GitHub deployment - continuing without deployment tracking",
      );
    }
  } catch (error) {
    core.warning(
      `⚠️ GitHub deployment creation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    core.warning(
      "Continuing without deployment tracking - this may be due to insufficient permissions",
    );
    deploymentStatusId = undefined;
  }

  let packageVersion: string | undefined;
  let deploymentUrl: string | undefined;
  let buildResult: { buildTime: number; snapshotResult?: any };

  try {
    buildResult = await runTscircuitBuild(inputs, circuitFiles);

    if (branch === "main" || branch === "master") {
      core.info("🚀 Main branch detected - publishing package - TODO PAUSED");
      deploymentUrl = `https://deploy.tscircuit.com/${deploymentId}`;

      // const lastTag = await getLastTag(octokit, context);
      // packageVersion = generateNextVersion(lastTag, context.payload.head_commit?.message || '');

      // core.info(`📦 Publishing version ${packageVersion}`);

      // await octokit.rest.git.createTag({
      //   owner: context.repo.owner,
      //   repo: context.repo.repo,
      //   tag: `v${packageVersion}`,
      //   message: `Release v${packageVersion}`,
      //   object: context.sha,
      //   type: 'commit',
      // });

      // await octokit.rest.git.createRef({
      //   owner: context.repo.owner,
      //   repo: context.repo.repo,
      //   ref: `refs/tags/v${packageVersion}`,
      //   sha: context.sha,
      // });
    }

    // Update deployment status to success
    if (deploymentStatusId) {
      try {
        await updateDeploymentStatus(
          octokit,
          context,
          deploymentStatusId,
          "success",
          `${environment} deployment completed with ${circuitFiles.length} circuit${circuitFiles.length === 1 ? "" : "s"}`,
          deploymentUrl,
        );
        core.info(`✅ Updated deployment status to success`);
      } catch (error) {
        core.warning(`⚠️ Failed to update deployment status: ${error}`);
      }
    }

    return {
      deploymentId,
      packageVersion,
      buildTime: buildResult.buildTime,
      circuitCount: circuitFiles.length,
      status: "ready",
    };
  } catch (error) {
    // Update deployment status to failure
    if (deploymentStatusId) {
      try {
        await updateDeploymentStatus(
          octokit,
          context,
          deploymentStatusId,
          "failure",
          `${environment} deployment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        core.info(`✅ Updated deployment status to failure`);
      } catch (deployError) {
        core.warning(`⚠️ Failed to update deployment status: ${deployError}`);
      }
    }

    throw error;
  }
}

async function findCircuitFiles(workingDirectory: string): Promise<string[]> {
  // Use the snapshot project's findCircuitFiles functionality
  const snapshotResult = await snapshotProject(workingDirectory);
  return snapshotResult.circuitFiles;
}

async function runTscircuitBuild(
  inputs: z.infer<typeof InputSchema>,
  circuitFiles: string[],
): Promise<{ buildTime: number; snapshotResult?: any }> {
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
    core.info(`   • SVG snapshots created: ${snapshotResult.svgFiles.length}`);
    core.info(`   • PNG snapshots created: ${snapshotResult.pngFiles.length}`);
    core.info(`   • Build time: ${snapshotResult.buildTime}s`);

    // Log SVG files for GitHub Actions output
    if (snapshotResult.svgFiles.length > 0) {
      core.startGroup("📸 Generated SVG Snapshots");
      snapshotResult.svgFiles.forEach((file) => {
        core.info(`  ${file}`);
      });
      core.endGroup();
    }

    // Log PNG files for GitHub Actions output
    if (snapshotResult.pngFiles.length > 0) {
      core.startGroup("📸 Generated PNG Snapshots");
      snapshotResult.pngFiles.forEach((file) => {
        core.info(`  ${file}`);
      });
      core.endGroup();
    }

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

function createImagePreviewsFromPng(
  pngPreviews: Array<{
    name: string;
    type: "pcb" | "schematic" | "3d";
    pngFilePath: string;
    svgFilePath: string;
  }>,
): string {
  const previewsToShow = pngPreviews.slice(0, 3);

  const previewItems = previewsToShow
    .map((preview) => {
      try {
        // Read PNG file and convert to base64 for embedding
        const pngBuffer = fs.readFileSync(preview.pngFilePath);
        const base64Png = pngBuffer.toString("base64");
        const dataUrl = `data:image/png;base64,${base64Png}`;
        const typeEmoji =
          preview.type === "pcb"
            ? "🟢"
            : preview.type === "schematic"
              ? "📋"
              : "🎯";

        return `#### ${typeEmoji} ${preview.name} (${preview.type.toUpperCase()})
![${preview.name} ${preview.type}](${dataUrl})`;
      } catch (error) {
        core.warning(`Failed to read PNG file for preview: ${error}`);
        return `#### ${preview.name} (${preview.type.toUpperCase()}) - *Preview unavailable*`;
      }
    })
    .join("\n\n");

  const extraCount =
    pngPreviews.length > 3
      ? `\n\n*...and ${pngPreviews.length - 3} more previews in the deployment.*`
      : "";

  return `
### 📸 Circuit Preview Images

${previewItems}${extraCount}
`;
}

function createPRComment(data: {
  deploymentId: string;
  previewUrl: string;
  buildTime: string;
  circuitCount: number;
  status: string;
  commitSha: string;
  svgPreviews?: Array<{
    name: string;
    type: "pcb" | "schematic" | "3d";
    svgContent: string;
    svgFilePath: string;
    pngFilePath?: string;
  }>;
  pngPreviews?: Array<{
    name: string;
    type: "pcb" | "schematic" | "3d";
    pngFilePath: string;
    svgFilePath: string;
  }>;
}): string {
  const {
    deploymentId,
    previewUrl,
    buildTime,
    circuitCount,
    status,
    commitSha,
    svgPreviews,
    pngPreviews,
  } = data;

  const statusEmoji =
    {
      ready: "✅",
      building: "🔄",
      error: "❌",
      pending: "⏳",
      cancelled: "🚫",
    }[status] || "❓";

  const svgCount = circuitCount * 3; // PCB, Schematic, 3D per circuit

  return `## ${statusEmoji} TSCircuit Deploy Bot

**${status === "ready" ? "Preview Deploy" : "Deployment Status"}**: ${status}

${status === "ready" ? `🔗 **Preview URL**: ${previewUrl}` : ""}
📊 **Circuits Found**: ${circuitCount}
📸 **Image Snapshots**: ${svgCount * 2} files (${circuitCount} × 6 views: SVG + PNG)
⏱️ **Build Time**: ${buildTime}
🔧 **Commit**: \`${commitSha.substring(0, 7)}\`

${
  status === "ready"
    ? `
### 🎨 Circuit Visualizations Generated

For each circuit file, we've generated:
- 🟢 **PCB View** - Physical board layout with components and traces
- 📋 **Schematic View** - Electrical connections and component symbols  
- 🎯 **3D View** - Isometric visualization of the assembled board

${pngPreviews && pngPreviews.length > 0 ? createImagePreviewsFromPng(pngPreviews) : ""}

### 📁 Snapshot Files
All generated files are stored in \`.tscircuit/snapshots/\`:
- \`[circuit-name]-pcb.svg/.png\` - PCB layout visualization
- \`[circuit-name]-schematic.svg/.png\` - Circuit schematic diagram
- \`[circuit-name]-3d.svg/.png\` - 3D board rendering

### 🚀 What's Included
- 📸 High-quality SVG and PNG circuit visualizations
- 🔧 Interactive circuit previews with embedded PNG images
- 📋 Professional PCB and schematic views in multiple formats
- 📊 Component layout and connection diagrams
- 🏭 Manufacturing-ready visualizations for download

[View deployment details →](${previewUrl}/deployment/${deploymentId})
`
    : ""
}

---
*🤖 Deployed by **TSCircuit Deploy Bot** • [View Snapshots](${previewUrl}/snapshots) • [Documentation](https://docs.tscircuit.com)*`;
}

async function createGitHubDeployment(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  environment: string,
  ref: string,
  description: string,
  payload: Record<string, unknown>,
): Promise<number | undefined> {
  try {
    const deployment = await octokit.rest.repos.createDeployment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref,
      environment,
      description,
      auto_merge: false,
      required_contexts: [],
      payload,
    });

    if ("id" in deployment.data) {
      await octokit.rest.repos.createDeploymentStatus({
        owner: context.repo.owner,
        repo: context.repo.repo,
        deployment_id: deployment.data.id,
        state: "in_progress",
        description: `Building ${environment} deployment...`,
        log_url: `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
      });
      return deployment.data.id;
    }
  } catch (error) {
    core.warning(`Failed to create GitHub deployment: ${error}`);
  }

  return undefined;
}

async function updateDeploymentStatus(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context,
  deploymentId: number,
  state: "success" | "failure",
  description: string,
  environmentUrl?: string,
): Promise<void> {
  try {
    await octokit.rest.repos.createDeploymentStatus({
      owner: context.repo.owner,
      repo: context.repo.repo,
      deployment_id: deploymentId,
      state,
      description,
      environment_url: environmentUrl,
      log_url: `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
    });
  } catch (error) {
    core.warning(`Failed to update deployment status: ${error}`);
  }
}

run();
