import { z } from "zod";

export const SnapshotResultSchema = z.object({
  circuitFiles: z.array(
    z.object({
      path: z.string(),
      name: z.string(),
      svg: z.object({
        pcb: z.string().nullable(),
        schematic: z.string().nullable(),
      }),
    }),
  ),
  buildTime: z.number(),
  success: z.boolean(),
  error: z.string().optional(),
});

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
