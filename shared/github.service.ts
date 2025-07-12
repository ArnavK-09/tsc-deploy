import * as github from "@actions/github";
import { z } from "zod";

const GitHubConfigSchema = z.object({
  token: z.string(),
});

type GitHubConfig = z.infer<typeof GitHubConfigSchema>;

export class GitHubService {
  private octokit: ReturnType<typeof github.getOctokit>;
  private config: GitHubConfig;

  constructor(config: GitHubConfig) {
    this.config = GitHubConfigSchema.parse(config);
    this.octokit = github.getOctokit(this.config.token);
  }

  async createDeployment(params: {
    owner: string;
    repo: string;
    ref: string;
    environment: string;
    description: string;
    payload: Record<string, unknown>;
  }): Promise<{ deploymentId: number | undefined }> {
    try {
      const deployment = await this.octokit.rest.repos.createDeployment({
        owner: params.owner,
        repo: params.repo,
        ref: params.ref,
        environment: params.environment,
        description: params.description,
        auto_merge: false,
        required_contexts: [],
        payload: params.payload,
      });

      if ("id" in deployment.data) {
        return { deploymentId: deployment.data.id };
      }
    } catch (error) {
      console.error("Failed to create GitHub deployment:", error);
    }

    return { deploymentId: undefined };
  }

  async createDeploymentStatus(params: {
    owner: string;
    repo: string;
    deploymentId: number;
    state: "in_progress" | "success" | "failure";
    description: string;
    environmentUrl?: string;
    logUrl: string;
  }): Promise<void> {
    try {
      await this.octokit.rest.repos.createDeploymentStatus({
        owner: params.owner,
        repo: params.repo,
        deployment_id: params.deploymentId,
        state: params.state,
        description: params.description,
        environment_url: params.environmentUrl,
        log_url: params.logUrl,
      });
    } catch (error) {
      console.error("Failed to update deployment status:", error);
      throw error;
    }
  }

  async createCheckRun(params: {
    owner: string;
    repo: string;
    name: string;
    headSha: string;
    status: "queued" | "in_progress" | "completed";
    detailsUrl?: string;
    output: {
      title: string;
      summary: string;
      text?: string;
    };
    conclusion?:
      | "success"
      | "failure"
      | "neutral"
      | "cancelled"
      | "skipped"
      | "timed_out";
  }): Promise<{ checkRunId: number | undefined }> {
    try {
      const checkRun = await this.octokit.rest.checks.create({
        owner: params.owner,
        repo: params.repo,
        name: params.name,
        head_sha: params.headSha,
        status: params.status,
        details_url: params.detailsUrl,
        output: params.output,
        conclusion: params.conclusion,
      });

      return { checkRunId: checkRun.data.id };
    } catch (error) {
      console.error("Failed to create check run:", error);
      return { checkRunId: undefined };
    }
  }

  async updateCheckRun(params: {
    owner: string;
    repo: string;
    checkRunId: number;
    status: "queued" | "in_progress" | "completed";
    conclusion?:
      | "success"
      | "failure"
      | "neutral"
      | "cancelled"
      | "skipped"
      | "timed_out";
    detailsUrl?: string;
    output: {
      title: string;
      summary: string;
      text?: string;
    };
  }): Promise<void> {
    try {
      await this.octokit.rest.checks.update({
        owner: params.owner,
        repo: params.repo,
        check_run_id: params.checkRunId,
        status: params.status,
        conclusion: params.conclusion,
        details_url: params.detailsUrl,
        output: params.output,
      });
    } catch (error) {
      console.error("Failed to update check run:", error);
      throw error;
    }
  }

  async createPRComment(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
  }): Promise<void> {
    try {
      await this.octokit.rest.issues.createComment({
        owner: params.owner,
        repo: params.repo,
        issue_number: params.issueNumber,
        body: params.body,
      });
    } catch (error) {
      console.error("Failed to create PR comment:", error);
      throw error;
    }
  }

  async createPRCommentWithUserToken(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    body: string;
    userToken: string;
  }): Promise<void> {
    try {
      const userOctokit = github.getOctokit(params.userToken);
      await userOctokit.rest.issues.createComment({
        owner: params.owner,
        repo: params.repo,
        issue_number: params.issueNumber,
        body: params.body,
      });
    } catch (error) {
      console.error("Failed to create PR comment with user token:", error);
      throw error;
    }
  }

  async getLatestTag(params: {
    owner: string;
    repo: string;
  }): Promise<{ tag: string | null }> {
    try {
      const tags = await this.octokit.rest.repos.listTags({
        owner: params.owner,
        repo: params.repo,
        per_page: 1,
      });

      if (tags.data.length > 0) {
        return { tag: tags.data[0].name };
      }
      return { tag: null };
    } catch (error) {
      console.error("Failed to get latest tag:", error);
      return { tag: null };
    }
  }

  async createTag(params: {
    owner: string;
    repo: string;
    tag: string;
    message: string;
    object: string;
    type: "commit" | "tree" | "blob";
  }): Promise<{ tagSha: string | undefined }> {
    try {
      const tagObject = await this.octokit.rest.git.createTag({
        owner: params.owner,
        repo: params.repo,
        tag: params.tag,
        message: params.message,
        object: params.object,
        type: params.type,
      });

      return { tagSha: tagObject.data.sha };
    } catch (error) {
      console.error("Failed to create tag:", error);
      return { tagSha: undefined };
    }
  }

  async createRef(params: {
    owner: string;
    repo: string;
    ref: string;
    sha: string;
  }): Promise<{ success: boolean }> {
    try {
      await this.octokit.rest.git.createRef({
        owner: params.owner,
        repo: params.repo,
        ref: params.ref,
        sha: params.sha,
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to create ref:", error);
      return { success: false };
    }
  }

  generateNextVersion(lastTag: string | null, commitMessage: string): string {
    let currentVersion = "0.0.0";

    if (lastTag) {
      currentVersion = lastTag.replace(/^v/, "");
    }

    const [major, minor, patch] = currentVersion.split(".").map(Number);

    if (
      commitMessage.includes("[major]") ||
      commitMessage.includes("BREAKING CHANGE")
    ) {
      return `${major + 1}.0.0`;
    } else if (
      commitMessage.includes("[minor]") ||
      commitMessage.includes("feat:")
    ) {
      return `${major}.${minor + 1}.0`;
    } else {
      return `${major}.${minor}.${patch + 1}`;
    }
  }
}
