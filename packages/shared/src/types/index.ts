import { z } from 'zod';

export const DeploymentStatusSchema = z.enum([
  'pending',
  'building',
  'ready',
  'error',
  'cancelled'
]);

export const DeploymentTypeSchema = z.enum([
  'preview',
  'production'
]);

export const RepositorySchema = z.object({
  id: z.number(),
  name: z.string(),
  fullName: z.string(),
  owner: z.string(),
  installationId: z.number(),
  defaultBranch: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const DeploymentSchema = z.object({
  id: z.string(),
  repositoryId: z.number(),
  commitSha: z.string(),
  branch: z.string(),
  status: DeploymentStatusSchema,
  type: DeploymentTypeSchema,
  url: z.string().optional(),
  previewUrl: z.string().optional(),
  buildLogs: z.string().optional(),
  errorMessage: z.string().optional(),
  pullRequestNumber: z.number().optional(),
  packageVersion: z.string().optional(),
  buildStartedAt: z.date().optional(),
  buildCompletedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const CircuitFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  sha: z.string()
});

export const SnapshotSchema = z.object({
  id: z.string(),
  deploymentId: z.string(),
  circuitPath: z.string(),
  snapshotData: z.record(z.any()),
  createdAt: z.date()
});

export const BuildArtifactSchema = z.object({
  id: z.string(),
  deploymentId: z.string(),
  type: z.enum(['pcb', 'schematic', 'bom', 'gerber']),
  fileName: z.string(),
  filePath: z.string(),
  fileSize: z.number(),
  contentType: z.string(),
  createdAt: z.date()
});

export const WebhookEventSchema = z.object({
  id: z.string(),
  repositoryId: z.number(),
  eventType: z.string(),
  payload: z.record(z.any()),
  processed: z.boolean(),
  createdAt: z.date()
});

export type DeploymentStatus = z.infer<typeof DeploymentStatusSchema>;
export type DeploymentType = z.infer<typeof DeploymentTypeSchema>;
export type Repository = z.infer<typeof RepositorySchema>;
export type Deployment = z.infer<typeof DeploymentSchema>;
export type CircuitFile = z.infer<typeof CircuitFileSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type BuildArtifact = z.infer<typeof BuildArtifactSchema>;
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export interface GitHubPRComment {
  deploymentId: string;
  previewUrl: string;
  buildTime: number;
  circuitCount: number;
  status: DeploymentStatus;
}

export interface BuildContext {
  repositoryId: number;
  commitSha: string;
  branch: string;
  pullRequestNumber?: number;
  circuitFiles: CircuitFile[];
  installationId: number;
}

export interface DeploymentResult {
  success: boolean;
  deploymentId: string;
  previewUrl?: string;
  errorMessage?: string;
  buildTime: number;
  artifacts: BuildArtifact[];
} 