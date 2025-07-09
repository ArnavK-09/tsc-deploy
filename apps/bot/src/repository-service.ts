import { db, repositories } from "@tscircuit-deploy/shared/db";
import { eq } from "drizzle-orm";

export interface CreateRepositoryData {
  githubId: number;
  name: string;
  fullName: string;
  owner: string;
  installationId: number;
  defaultBranch: string;
  isActive: boolean;
}

export class RepositoryService {
  async createRepository(data: CreateRepositoryData) {
    try {
      const existing = await this.getRepositoryByGithubId(data.githubId);

      if (existing) {
        return await db
          .update(repositories)
          .set({
            name: data.name,
            fullName: data.fullName,
            owner: data.owner,
            installationId: data.installationId,
            defaultBranch: data.defaultBranch,
            isActive: data.isActive,
            updatedAt: new Date(),
          })
          .where(eq(repositories.githubId, data.githubId))
          .returning();
      }

      return await db
        .insert(repositories)
        .values({
          githubId: data.githubId,
          name: data.name,
          fullName: data.fullName,
          owner: data.owner,
          installationId: data.installationId,
          defaultBranch: data.defaultBranch,
          isActive: data.isActive,
        })
        .returning();
    } catch (error) {
      console.error("Failed to create repository:", error);
      throw error;
    }
  }

  async getRepositoryByGithubId(githubId: number) {
    try {
      const result = await db
        .select()
        .from(repositories)
        .where(eq(repositories.githubId, githubId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error("Failed to get repository by GitHub ID:", error);
      return null;
    }
  }

  async getRepositoryById(id: number) {
    try {
      const result = await db
        .select()
        .from(repositories)
        .where(eq(repositories.id, id))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error("Failed to get repository by ID:", error);
      return null;
    }
  }

  async updateRepositorySettings(
    id: number,
    settings: {
      autoPublish?: boolean;
      buildTimeout?: number;
      notificationChannels?: string[];
    },
  ) {
    try {
      return await db
        .update(repositories)
        .set({
          settings,
          updatedAt: new Date(),
        })
        .where(eq(repositories.id, id))
        .returning();
    } catch (error) {
      console.error("Failed to update repository settings:", error);
      throw error;
    }
  }

  async deactivateRepository(githubId: number) {
    try {
      return await db
        .update(repositories)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(repositories.githubId, githubId))
        .returning();
    } catch (error) {
      console.error("Failed to deactivate repository:", error);
      throw error;
    }
  }

  async getActiveRepositories() {
    try {
      return await db
        .select()
        .from(repositories)
        .where(eq(repositories.isActive, true));
    } catch (error) {
      console.error("Failed to get active repositories:", error);
      return [];
    }
  }
}
