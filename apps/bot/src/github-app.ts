import { App } from "@octokit/app";
import { Webhooks } from "@octokit/webhooks";
import { Octokit } from "@octokit/rest";
import type { RestEndpointMethodTypes } from "@octokit/rest";

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  webhookSecret: string;
  clientId?: string;
  clientSecret?: string;
}

export class GitHubAppService {
  private app: App;
  private webhooks: Webhooks;

  constructor(private config: GitHubAppConfig) {
    this.app = new App({
      appId: config.appId,
      privateKey: config.privateKey,
      webhooks: {
        secret: config.webhookSecret,
      },
    });

    this.webhooks = new Webhooks({
      secret: config.webhookSecret,
    });
  }

  async getInstallationOctokit(installationId: number) {
    return this.app.getInstallationOctokit(installationId) as any;
  }

  async getAppOctokit() {
    return this.app.octokit as any;
  }

  getWebhooks(): Webhooks {
    return this.webhooks;
  }

  async verifyWebhook(signature: string, payload: string): Promise<boolean> {
    try {
      return this.webhooks.verify(payload, signature);
    } catch (error) {
      console.error("Webhook verification failed:", error);
      return false;
    }
  }

  async createCheckRun(
    installationId: number,
    owner: string,
    repo: string,
    options: {
      name: string;
      head_sha: string;
      status?: "queued" | "in_progress" | "completed";
      conclusion?:
        | "success"
        | "failure"
        | "neutral"
        | "cancelled"
        | "timed_out"
        | "action_required";
      details_url?: string;
      output?: {
        title: string;
        summary: string;
        text?: string;
      };
    },
  ) {
    const octokit = await this.getInstallationOctokit(installationId);

    return octokit.rest.checks.create({
      owner,
      repo,
      ...options,
    });
  }

  async updateCheckRun(
    installationId: number,
    owner: string,
    repo: string,
    checkRunId: number,
    options: {
      status?: "queued" | "in_progress" | "completed";
      conclusion?:
        | "success"
        | "failure"
        | "neutral"
        | "cancelled"
        | "timed_out"
        | "action_required";
      details_url?: string;
      output?: {
        title: string;
        summary: string;
        text?: string;
      };
    },
  ) {
    const octokit = await this.getInstallationOctokit(installationId);

    return octokit.rest.checks.update({
      owner,
      repo,
      check_run_id: checkRunId,
      ...options,
    });
  }

  async createPRComment(
    installationId: number,
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
  ) {
    const octokit = await this.getInstallationOctokit(installationId);

    return octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pullNumber,
      body,
    });
  }

  async updatePRComment(
    installationId: number,
    owner: string,
    repo: string,
    commentId: number,
    body: string,
  ) {
    const octokit = await this.getInstallationOctokit(installationId);

    return octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: commentId,
      body,
    });
  }

  async getRepositoryFiles(
    installationId: number,
    owner: string,
    repo: string,
    ref: string,
    path = "",
  ): Promise<Array<{ path: string; content: string; sha: string }>> {
    const octokit = await this.getInstallationOctokit(installationId);

    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (Array.isArray(data)) {
        const files: Array<{ path: string; content: string; sha: string }> = [];

        for (const item of data) {
          if (item.type === "file" && item.name?.endsWith(".circuit.tsx")) {
            const fileData = await octokit.rest.repos.getContent({
              owner,
              repo,
              path: item.path,
              ref,
            });

            if (
              !Array.isArray(fileData.data) &&
              fileData.data.type === "file" &&
              "content" in fileData.data
            ) {
              files.push({
                path: item.path,
                content: Buffer.from(fileData.data.content, "base64").toString(
                  "utf8",
                ),
                sha: fileData.data.sha,
              });
            }
          } else if (item.type === "dir") {
            const subFiles = await this.getRepositoryFiles(
              installationId,
              owner,
              repo,
              ref,
              item.path,
            );
            files.push(...subFiles);
          }
        }

        return files;
      } else if (
        data.type === "file" &&
        data.path?.endsWith(".circuit.tsx") &&
        data.content
      ) {
        return [
          {
            path: data.path,
            content: Buffer.from(data.content, "base64").toString("utf8"),
            sha: data.sha,
          },
        ];
      }

      return [];
    } catch (error) {
      console.error(
        `Failed to get repository files for ${owner}/${repo}:`,
        error,
      );
      return [];
    }
  }

  async createDeploymentStatus(
    installationId: number,
    owner: string,
    repo: string,
    deploymentId: number,
    state: "error" | "failure" | "inactive" | "pending" | "success",
    options?: {
      target_url?: string;
      log_url?: string;
      description?: string;
      environment_url?: string;
      auto_inactive?: boolean;
    },
  ) {
    const octokit = await this.getInstallationOctokit(installationId);

    return octokit.rest.repos.createDeploymentStatus({
      owner,
      repo,
      deployment_id: deploymentId,
      state,
      ...options,
    });
  }
}
