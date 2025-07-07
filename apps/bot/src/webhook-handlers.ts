import { InstallationEvent, InstallationRepositoriesEvent, PullRequestEvent, PushEvent   } from '@octokit/webhooks-types';
import { GitHubAppService } from './github-app.js';
import { BuildService } from './build-service.js';
import { RepositoryService } from './repository-service.js';
import { generateDeploymentId, createPRComment, extractCircuitFiles } from '@tscircuit-deploy/shared/utils';
import { db, repositories, deployments, webhookEvents } from '@tscircuit-deploy/shared/db';
import { eq } from 'drizzle-orm';

export class WebhookHandlers {
  constructor(
    private githubApp: GitHubAppService,
    private buildService: BuildService,
    private repositoryService: RepositoryService
  ) {}

  async handleInstallation(payload: InstallationEvent & { action: 'created' | 'deleted' }) {
    console.log(`Installation ${payload.action}:`, payload.installation.id);

    if (payload.action === 'created') {
      for (const repo of payload?.repositories || []) {
        await this.repositoryService.createRepository({
          githubId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          owner: payload.installation.account.login,
          installationId: payload.installation.id,
          defaultBranch: 'main',
          isActive: true,
        });
      }
    } else if (payload.action === 'deleted') {
      await db
        .update(repositories)
        .set({ isActive: false })
        .where(eq(repositories.installationId, payload.installation.id));
    }
  }

  async handleInstallationRepositories(payload: InstallationRepositoriesEvent & { action: 'added' | 'removed' }) {
    console.log(`Installation repositories ${payload.action}:`, payload.repositories_added?.length || payload.repositories_removed?.length);

    if (payload.action === 'added' && payload.repositories_added) {
      for (const repo of payload.repositories_added) {
        await this.repositoryService.createRepository({
          githubId: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          owner: payload.installation.account.login,
          installationId: payload.installation.id,
          defaultBranch: 'main',
          isActive: true,
        });
      }
    } else if (payload.action === 'removed' && payload.repositories_removed) {
      for (const repo of payload.repositories_removed) {
        await db
          .update(repositories)
          .set({ isActive: false })
          .where(eq(repositories.githubId, repo.id));
      }
    }
  }

  async handlePullRequest(payload: PullRequestEvent) {
    const { action, pull_request, repository, installation } = payload;
    
    if (!installation) {
      console.log('No installation found for PR webhook');
      return;
    }

    console.log(`PR ${action}: ${repository.full_name}#${pull_request.number}`);

    if (action === 'opened' || action === 'synchronize' || action === 'reopened') {
      const repo = await this.repositoryService.getRepositoryByGithubId(repository.id);
      if (!repo) {
        console.log(`Repository not found: ${repository.id}`);
        return;
      }

      const circuitFiles = await this.githubApp.getRepositoryFiles(
        installation.id,
        repository.owner.login,
        repository.name,
        pull_request.head.sha
      );

      if (circuitFiles.length === 0) {
        console.log(`No circuit files found in PR ${pull_request.number}`);
        return;
      }

      const deploymentId = generateDeploymentId();
      
      await db.insert(deployments).values({
        id: deploymentId,
        repositoryId: repo.id,
        commitSha: pull_request.head.sha,
        branch: pull_request.head.ref,
        status: 'pending',
        type: 'preview',
        pullRequestNumber: pull_request.number,
        circuitCount: circuitFiles.length,
      });

      await this.githubApp.createCheckRun(
        installation.id,
        repository.owner.login,
        repository.name,
        {
          name: 'tscircuit Deploy',
          head_sha: pull_request.head.sha,
          status: 'in_progress',
          details_url: `https://deploy.tscircuit.com/deployment/${deploymentId}`,
          output: {
            title: 'Building Preview Deploy',
            summary: `Found ${circuitFiles.length} circuit file${circuitFiles.length === 1 ? '' : 's'}. Starting build...`,
          },
        }
      );

      const comment = createPRComment({
        deploymentId,
        previewUrl: `https://${deploymentId}.preview.tscircuit.com`,
        buildTime: '⏳ Building...',
        circuitCount: circuitFiles.length,
        status: 'building',
        commitSha: pull_request.head.sha,
      });

      await this.githubApp.createPRComment(
        installation.id,
        repository.owner.login,
        repository.name,
        pull_request.number,
        comment
      );

      await this.buildService.startBuild({
        repositoryId: repo.id,
        commitSha: pull_request.head.sha,
        branch: pull_request.head.ref,
        pullRequestNumber: pull_request.number,
        circuitFiles,
        installationId: installation.id,
      });
    }
  }

  async handlePush(payload: PushEvent) {
    const { ref, repository, installation, commits } = payload;
    
    if (!installation) {
      console.log('No installation found for push webhook');
      return;
    }

    const branch = ref.replace('refs/heads/', '');
    console.log(`Push to ${repository.full_name}:${branch}`);

    const repo = await this.repositoryService.getRepositoryByGithubId(repository.id);
    if (!repo) {
      console.log(`Repository not found: ${repository.id}`);
      return;
    }

    if (branch === repo.defaultBranch) {
      const latestCommit = commits[commits.length - 1];
      if (!latestCommit) return;

      const circuitFiles = await this.githubApp.getRepositoryFiles(
        installation.id,
        repository.owner.login,
        repository.name,
        latestCommit.id
      );

      if (circuitFiles.length === 0) {
        console.log(`No circuit files found in push to ${branch}`);
        return;
      }

      const deploymentId = generateDeploymentId();
      
      await db.insert(deployments).values({
        id: deploymentId,
        repositoryId: repo.id,
        commitSha: latestCommit.id,
        branch,
        status: 'pending',
        type: 'production',
        circuitCount: circuitFiles.length,
      });

      await this.buildService.startBuild({
        repositoryId: repo.id,
        commitSha: latestCommit.id,
        branch,
        circuitFiles,
        installationId: installation.id,
      });
    }
  }

  async logWebhookEvent(eventType: string, payload: any, repositoryId?: number) {
    try {
      await db.insert(webhookEvents).values({
        id: generateDeploymentId(),
        repositoryId,
        eventType,
        payload,
        processed: false,
      });
    } catch (error) {
      console.error('Failed to log webhook event:', error);
    }
  }
} 