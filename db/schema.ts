import {
  pgTable,
  text,
  timestamp,
  integer,
  varchar,
  pgEnum,
  jsonb,
  uuid,
} from "drizzle-orm/pg-core";

export const deploymentStatus = pgEnum("deployment_status", [
  "skipped",
  "ready",
  "error",
  "pending",
]);

export const metaType = pgEnum("meta_type", ["push", "pull_request"]);

export const jobStatus = pgEnum("job_status", [
  "queued",
  "processing",
  "completed",
  "failed",
  "cancelled",
]);

export const deployments = pgTable("deployments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  commitSha: varchar("commit_sha", { length: 40 }).notNull(),
  status: deploymentStatus("status").default("pending"),
  meta: text("meta").notNull(),
  metaType: metaType("meta_type").notNull(),
  buildCompletedAt: timestamp("build_completed_at"),
  buildDuration: integer("build_duration"),
  totalCircuitFiles: integer("circuit_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  snapshotResult: jsonb("snapshot_result"),
});

export const buildJobs = pgTable("build_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  deploymentId: varchar("deployment_id", { length: 36 })
    .references(() => deployments.id)
    .notNull(),
  status: jobStatus("status").default("queued").notNull().default("queued"),
  priority: integer("priority").default(0).notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  retryCount: integer("retry_count").default(0).notNull(),
  errorMessage: text("error_message"),
  queuedAt: timestamp("queued_at").notNull().defaultNow(),
  progress: integer("progress").default(0),
  logs: text("logs"),
  metadata: jsonb("metadata"),
});

export const buildArtifacts = pgTable("build_artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .references(() => buildJobs.id, {
      onDelete: "set null",
    })
    .notNull(),
  deploymentId: varchar("deployment_id", { length: 36 })
    .references(() => buildJobs.deploymentId, {
      onDelete: "cascade",
    })
    .notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileSize: integer("file_size"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  circuitJson: jsonb("circuit_json"),
});
