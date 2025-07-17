import { z } from "zod";

export const CircuitFileSchema = z.object({
  path: z.string(),
  name: z.string(),
  circuitJson: z.any(), // Store the actual circuit JSON
  metadata: z
    .object({
      fileSize: z.number(),
      lastModified: z.string(),
      checksum: z.string(),
    })
    .optional(),
});

export const SnapshotResultSchema = z.object({
  circuitFiles: z.array(CircuitFileSchema),
  buildTime: z.number(),
  success: z.boolean(),
  error: z.string().optional(),
  metadata: z
    .object({
      totalFiles: z.number(),
      repositorySize: z.number(),
      buildEnvironment: z.string(),
    })
    .optional(),
});

export type CircuitFile = z.infer<typeof CircuitFileSchema>;
export type SnapshotResult = z.infer<typeof SnapshotResultSchema>;

export const DeploymentRequestSchema = z.object({
  id: z.string(),
  owner: z.string(),
  repo: z.string(),
  ref: z.string(),
  environment: z.string(),
  eventType: z.string(),
  meta: z.string(),
  context: z.object({
    serverUrl: z.string(),
    runId: z.string(),
    sha: z.string(),
    message: z.string().optional(),
  }),
  snapshotResult: SnapshotResultSchema,
  buildTime: z.number(),
  deploymentId: z.number(),
  checkRunId: z.number().optional(),
  create_release: z.boolean().default(false).optional(),
});

export type DeploymentRequest = z.infer<typeof DeploymentRequestSchema>;

export const SimpleBuildRequestSchema = z.object({
  id: z.string(),
  owner: z.string(),
  repo: z.string(),
  ref: z.string(),
  environment: z.string(),
  eventType: z.string(),
  meta: z.string(),
  context: z.object({
    serverUrl: z.string(),
    runId: z.string(),
    sha: z.string(),
    message: z.string().optional(),
  }),
  deploymentId: z.number(),
  checkRunId: z.number().optional(),
  create_release: z.boolean().default(false).optional(),
  repoArchiveUrl: z.string().optional(),
});

export type SimpleBuildRequest = z.infer<typeof SimpleBuildRequestSchema>;

export const BuildStatusSchema = z.object({
  jobId: z.string(),
  status: z.enum(["queued", "processing", "completed", "failed", "cancelled"]),
  progress: z.number(),
  message: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  errorMessage: z.string().optional(),
  estimatedDuration: z.number().optional(),
  queuePosition: z.number().optional(),
});

export type BuildStatus = z.infer<typeof BuildStatusSchema>;

export const DeploymentViewSchema = z.object({
  id: z.string(),
  owner: z.string(),
  repo: z.string(),
  commitSha: z.string(),
  status: z.enum(["skipped", "ready", "error", "pending"]),
  metaType: z.enum(["push", "pull_request"]),
  meta: z.string(),
  buildDuration: z.number().nullable(),
  totalCircuitFiles: z.number(),
  createdAt: z.string(),
  buildCompletedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
  artifactCount: z.number().optional(),
  hasArtifacts: z.boolean().optional(),
});

export type DeploymentView = z.infer<typeof DeploymentViewSchema>;
