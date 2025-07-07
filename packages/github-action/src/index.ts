import * as core from '@actions/core';
import * as github from '@actions/github';
import { exec } from '@actions/exec';
import { z } from 'zod';

const InputSchema = z.object({
  args: z.string().default('deploy'),
  githubToken: z.string(),
  deployUrl: z.string().default('https://deploy.tscircuit.com'),
  timeout: z.string().default('10').transform(val => parseInt(val)),
  workingDirectory: z.string().default('.'),
});

interface DeploymentResult {
  deploymentId: string;
  previewUrl?: string;
  packageVersion?: string;
  buildTime: number;
  circuitCount: number;
  status: string;
}

async function run(): Promise<void> {
  try {
    const inputs = InputSchema.parse({
      args: core.getInput('args'),
      githubToken: core.getInput('github-token'),
      deployUrl: core.getInput('deploy-url'),
      timeout: core.getInput('timeout'),
      workingDirectory: core.getInput('working-directory'),
    });

    const context = github.context;
    const octokit = github.getOctokit(inputs.githubToken);

    core.info(`🔌 Starting tscircuit Deploy`);
    core.info(`Repository: ${context.repo.owner}/${context.repo.repo}`);
    core.info(`Event: ${context.eventName}`);
    core.info(`SHA: ${context.sha}`);

    const startTime = Date.now();

    let deploymentResult: DeploymentResult;

    switch (context.eventName) {
      case 'pull_request':
        deploymentResult = await handlePullRequest(inputs, context, octokit);
        break;
      
      case 'push':
        deploymentResult = await handlePush(inputs, context, octokit);
        break;
      
      default:
        throw new Error(`Unsupported event type: ${context.eventName}`);
    }

    const totalTime = Math.round((Date.now() - startTime) / 1000);

    core.setOutput('deployment-id', deploymentResult.deploymentId);
    core.setOutput('build-time', totalTime.toString());
    core.setOutput('circuit-count', deploymentResult.circuitCount.toString());

    if (deploymentResult.previewUrl) {
      core.setOutput('preview-url', deploymentResult.previewUrl);
    }

    if (deploymentResult.packageVersion) {
      core.setOutput('package-version', deploymentResult.packageVersion);
    }

    core.info(`✅ Deployment completed successfully`);
    core.info(`🆔 Deployment ID: ${deploymentResult.deploymentId}`);
    core.info(`⏱️ Total time: ${totalTime}s`);
    core.info(`📊 Circuits processed: ${deploymentResult.circuitCount}`);

    if (deploymentResult.previewUrl) {
      core.info(`🔗 Preview URL: ${deploymentResult.previewUrl}`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    core.setFailed(`❌ tscircuit Deploy failed: ${errorMessage}`);
  }
}

async function handlePullRequest(
  inputs: z.infer<typeof InputSchema>,
  context: typeof github.context,
  octokit: ReturnType<typeof github.getOctokit>
): Promise<DeploymentResult> {
  core.info(`🔄 Processing pull request #${context.payload.pull_request?.number}`);

  const pullRequest = context.payload.pull_request;
  if (!pullRequest) {
    throw new Error('Pull request data not available');
  }

  const circuitFiles = await findCircuitFiles(inputs.workingDirectory);
  
  if (circuitFiles.length === 0) {
    core.warning('⚠️ No circuit files found - skipping deployment');
    return {
      deploymentId: 'no-circuits',
      buildTime: 0,
      circuitCount: 0,
      status: 'skipped',
    };
  }

  core.info(`📋 Found ${circuitFiles.length} circuit file(s)`);

  const deploymentId = generateDeploymentId();
  const previewUrl = `https://${deploymentId}.preview.tscircuit.com`;

  const checkRun = await octokit.rest.checks.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    name: 'tscircuit Deploy',
    head_sha: pullRequest.head.sha,
    status: 'in_progress',
    details_url: previewUrl,
    output: {
      title: 'Building Preview Deploy',
      summary: `Found ${circuitFiles.length} circuit file${circuitFiles.length === 1 ? '' : 's'}. Starting build...`,
    },
  });

  try {
    const buildResult = await runTscircuitBuild(inputs, circuitFiles);

    await octokit.rest.checks.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      check_run_id: checkRun.data.id,
      status: 'completed',
      conclusion: 'success',
      details_url: previewUrl,
      output: {
        title: 'Preview Deploy Ready',
        summary: `✅ Successfully built ${circuitFiles.length} circuit${circuitFiles.length === 1 ? '' : 's'} in ${buildResult.buildTime}s`,
        text: `## 🔗 Preview URL\n${previewUrl}\n\n## 📊 Build Details\n- Circuits: ${circuitFiles.length}\n- Build time: ${buildResult.buildTime}s\n- Status: Ready`,
      },
    });

    const comment = createPRComment({
      deploymentId,
      previewUrl,
      buildTime: `${buildResult.buildTime}s`,
      circuitCount: circuitFiles.length,
      status: 'ready',
      commitSha: pullRequest.head.sha,
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
      status: 'ready',
    };

  } catch (error) {
    await octokit.rest.checks.update({
      owner: context.repo.owner,
      repo: context.repo.repo,
      check_run_id: checkRun.data.id,
      status: 'completed',
      conclusion: 'failure',
      output: {
        title: 'Build Failed',
        summary: `❌ Build failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    });

    throw error;
  }
}

async function handlePush(
  inputs: z.infer<typeof InputSchema>,
  context: typeof github.context,
  octokit: ReturnType<typeof github.getOctokit>
): Promise<DeploymentResult> {
  const ref = context.ref;
  const branch = ref.replace('refs/heads/', '');
  
  core.info(`📤 Processing push to ${branch}`);

  const circuitFiles = await findCircuitFiles(inputs.workingDirectory);
  
  if (circuitFiles.length === 0) {
    core.warning('⚠️ No circuit files found - skipping deployment');
    return {
      deploymentId: 'no-circuits',
      buildTime: 0,
      circuitCount: 0,
      status: 'skipped',
    };
  }

  const deploymentId = generateDeploymentId();
  const buildResult = await runTscircuitBuild(inputs, circuitFiles);

  let packageVersion: string | undefined;

  if (branch === 'main' || branch === 'master') {
    core.info('🚀 Main branch detected - publishing package');
    
    const lastTag = await getLastTag(octokit, context);
    packageVersion = generateNextVersion(lastTag, context.payload.head_commit?.message || '');
    
    core.info(`📦 Publishing version ${packageVersion}`);

    await octokit.rest.git.createTag({
      owner: context.repo.owner,
      repo: context.repo.repo,
      tag: `v${packageVersion}`,
      message: `Release v${packageVersion}`,
      object: context.sha,
      type: 'commit',
    });

    await octokit.rest.git.createRef({
      owner: context.repo.owner,
      repo: context.repo.repo,
      ref: `refs/tags/v${packageVersion}`,
      sha: context.sha,
    });
  }

  return {
    deploymentId,
    packageVersion,
    buildTime: buildResult.buildTime,
    circuitCount: circuitFiles.length,
    status: 'ready',
  };
}

async function findCircuitFiles(workingDirectory: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    let output = '';
    await exec('find', ['.', '-name', '*.circuit.tsx', '-o', '-name', '*.circuit.ts'], {
      cwd: workingDirectory,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
      },
    });
    
    files.push(...output.trim().split('\n').filter(f => f.length > 0));
  } catch (error) {
    core.warning(`Failed to find circuit files: ${error}`);
  }

  return files;
}

async function runTscircuitBuild(
  inputs: z.infer<typeof InputSchema>,
  circuitFiles: string[]
): Promise<{ buildTime: number }> {
  const startTime = Date.now();
  
  core.info('📦 Installing tscircuit CLI...');
  
  try {
    await exec('npm', ['install', '-g', '@tscircuit/cli'], {
      cwd: inputs.workingDirectory,
    });
  } catch (error) {
    throw new Error(`Failed to install tscircuit CLI: ${error}`);
  }

  core.info('🔨 Running tscircuit build...');
  
  try {
    // Create a timeout promise
    const timeoutMs = inputs.timeout * 60 * 1000; // Convert minutes to milliseconds
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Build timeout after ${inputs.timeout} minutes`)), timeoutMs);
    });

    // Race between exec and timeout
    await Promise.race([
      exec('tscircuit', [inputs.args], {
        cwd: inputs.workingDirectory,
      }),
      timeoutPromise
    ]);
  } catch (error) {
    throw new Error(`tscircuit build failed: ${error}`);
  }

  const buildTime = Math.round((Date.now() - startTime) / 1000);
  
  return { buildTime };
}

async function getLastTag(
  octokit: ReturnType<typeof github.getOctokit>,
  context: typeof github.context
): Promise<string> {
  try {
    const { data: tags } = await octokit.rest.repos.listTags({
      owner: context.repo.owner,
      repo: context.repo.repo,
      per_page: 1,
    });

    if (tags.length > 0) {
      return tags[0].name.replace(/^v/, '');
    }
  } catch (error) {
    core.warning(`Failed to get last tag: ${error}`);
  }

  return '0.0.0';
}

function generateNextVersion(currentVersion: string, commitMessage: string): string {
  const [major, minor, patch] = currentVersion.split('.').map(Number);
  
  const conventionalCommitRegex = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?(!)?:/;
  const match = commitMessage.match(conventionalCommitRegex);
  
  if (!match) {
    return `${major}.${minor}.${patch + 1}`;
  }
  
  const [, type, , breaking] = match;
  
  if (breaking === '!' || commitMessage.toLowerCase().includes('breaking change')) {
    return `${major + 1}.0.0`;
  }
  
  if (type === 'feat') {
    return `${major}.${minor + 1}.0`;
  }
  
  return `${major}.${minor}.${patch + 1}`;
}

function generateDeploymentId(): string {
  return `deploy-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

function createPRComment(data: {
  deploymentId: string;
  previewUrl: string;
  buildTime: string;
  circuitCount: number;
  status: string;
  commitSha: string;
}): string {
  const { deploymentId, previewUrl, buildTime, circuitCount, status, commitSha } = data;
  
  const statusEmoji = {
    ready: '✅',
    building: '🔄',
    error: '❌',
    pending: '⏳',
    cancelled: '🚫'
  }[status] || '❓';

  return `## ${statusEmoji} tscircuit Deploy

**${status === 'ready' ? 'Preview Deploy' : 'Deployment Status'}**: ${status}

${status === 'ready' ? `🔗 **Preview URL**: ${previewUrl}` : ''}
📊 **Circuits Found**: ${circuitCount}
⏱️ **Build Time**: ${buildTime}
🔧 **Commit**: \`${commitSha.substring(0, 7)}\`

${status === 'ready' ? `
### What's Included
- Interactive circuit previews
- PCB and schematic views
- Component bill of materials
- Gerber files for manufacturing

[View deployment details →](${previewUrl}/deployment/${deploymentId})
` : ''}

---
*Powered by [tscircuit Deploy](https://tscircuit.com)*`;
}

run(); 