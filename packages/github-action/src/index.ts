import * as core from "@actions/core";
import * as github from "@actions/github";
import { z } from "zod";
import snapshotProject, {
  findCircuitFiles,
  SnapshotResult,
} from "./snapshot-project";
import { App } from "octokit";
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
    const app = new App({
      appId: "1546076",
      privateKey: `-----BEGIN RSA PRIVATE KEY-----
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
    });
    core.info(`\n🔌 Starting tscircuit Deploy`);
    core.info(`\tRepository: ${context.repo.owner}/${context.repo.repo}`);
    core.info(`\tEvent: ${context.eventName}`);
    core.info(`\tSHA: ${context.sha}`);

    const startTime = Date.now();

    let deploymentResult: DeploymentResult;

    switch (context.eventName) {
      case "pull_request":
        deploymentResult = await handlePullRequest(inputs, context, octokit, app);
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
  app: App,
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
            title: "✅ Preview Deploy Ready",
            summary: `Successfully built ${circuitFiles.length} circuit${circuitFiles.length === 1 ? "" : "s"} in ${buildResult.buildTime}s`,
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

    const comment = generatePRComment({
      deploymentId,
      previewUrl,
      buildTime: `${buildResult.buildTime}s`,
      circuitCount: circuitFiles.length,
      status: "ready",
      commitSha: pullRequest.head.sha,
      snapshotResult: buildResult.snapshotResult,
    });

    await octokit.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: pullRequest.number,
      body: comment,
    });

    await app.octokit.rest.issues.createComment({
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
            title: "🔴 Build Failed",
            summary: `Build failed: ${error instanceof Error ? error.message : "Unknown error"}`,
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
  let buildResult: { buildTime: number; snapshotResult: SnapshotResult };

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

function createDeploymentTable(data: {
  deploymentId: string;
  previewUrl: string;
  buildTime: string;
  circuitCount: number;
  status: "ready" | "error" | "skipped";
  commitSha: string;
}): string {
  const {
    deploymentId,
    previewUrl,
    buildTime,
    circuitCount,
    status,
    commitSha,
  } = data;

  const statusDisplay = {
    ready: "✅ Ready",
    error: "❌ Failed",
    skipped: "⏭️ Skipped",
  }[status];

  const inspectUrl = `${previewUrl}/inspect`;
  const currentTime = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `| Name | Status | Preview | Circuits | Updated |
| :--- | :----- | :------ | :------- | :------ |
| **${deploymentId.substring(0, 20)}...** | ${statusDisplay} ([Inspect](${inspectUrl})) | ${status === "ready" ? `[Visit Preview](${previewUrl})` : "—"} | ${circuitCount} files | ${currentTime} |`;
}

function createImagePreviewTable(
  circuitFiles: SnapshotResult["circuitFiles"],
): string {
  if (!circuitFiles.length) return "";

  // Group previews by circuit name
  const circuitGroups = new Map<string, typeof circuitFiles>();

  circuitFiles.forEach((file) => {
    if (!circuitGroups.has(file.name)) {
      circuitGroups.set(file.name, []);
    }
    circuitGroups.get(file.name)!.push(file);
  });

  const tableRows = Array.from(circuitGroups.entries())
    .map(([circuitName]) => {
      const pcbSvg = circuitGroups.get(circuitName)?.[0]?.svg.pcb;
      const schematicSvg = circuitGroups.get(circuitName)?.[0]?.svg.schematic;

      const pcbCell = `<img src="${pcbSvg}" alt="PCB" width="120" height="80" />`;
      const schematicCell = `<img src="${schematicSvg}" alt="Schematic" width="120" height="80" />`;

      return `| **${circuitName}** | ${pcbCell} | ${schematicCell} |`;
    })
    .join("\n");

  return `
## 📸 Circuit Previews

| Circuit | PCB | Schematic |
| :------ | :-: | :-------: |
${tableRows}`;
}

function generatePRComment(data: {
  deploymentId: string;
  previewUrl: string;
  buildTime: string;
  circuitCount: number;
  status: "ready" | "error" | "skipped";
  commitSha: string;
  snapshotResult: SnapshotResult;
}): string {
  const {
    deploymentId,
    previewUrl,
    buildTime,
    circuitCount,
    status,
    commitSha,
    snapshotResult,
  } = data;

  const deploymentTable = createDeploymentTable({
    deploymentId,
    previewUrl,
    buildTime,
    circuitCount,
    status,
    commitSha,
  });

  const imagePreviewTable =
    snapshotResult.circuitFiles.length > 0
      ? createImagePreviewTable(snapshotResult.circuitFiles)
      : "";

  return `## 🔌 tscircuit deploy

${deploymentTable}

${imagePreviewTable}

---
*🤖 Automated deployment by [tscircuit](https://tscircuit.com) • [View Snapshots](${previewUrl}/snapshots)*`;
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
