import { pgTable, serial, text, timestamp, boolean, integer, json, varchar, bigint } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const repositories = pgTable('repositories', {
  id: serial('id').primaryKey(),
  githubId: bigint('github_id', { mode: 'number' }).notNull().unique(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  owner: text('owner').notNull(),
  installationId: bigint('installation_id', { mode: 'number' }).notNull(),
  defaultBranch: text('default_branch').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  settings: json('settings').$type<{
    autoPublish?: boolean;
    buildTimeout?: number;
    notificationChannels?: string[];
  }>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const deployments = pgTable('deployments', {
  id: varchar('id', { length: 36 }).primaryKey(),
  repositoryId: integer('repository_id').notNull().references(() => repositories.id),
  commitSha: varchar('commit_sha', { length: 40 }).notNull(),
  branch: text('branch').notNull(),
  status: varchar('status', { length: 20 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  url: text('url'),
  previewUrl: text('preview_url'),
  buildLogs: text('build_logs'),
  errorMessage: text('error_message'),
  pullRequestNumber: integer('pull_request_number'),
  packageVersion: text('package_version'),
  buildStartedAt: timestamp('build_started_at'),
  buildCompletedAt: timestamp('build_completed_at'),
  buildDuration: integer('build_duration'),
  circuitCount: integer('circuit_count').default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const snapshots = pgTable('snapshots', {
  id: varchar('id', { length: 36 }).primaryKey(),
  deploymentId: varchar('deployment_id', { length: 36 }).notNull().references(() => deployments.id),
  circuitPath: text('circuit_path').notNull(),
  snapshotData: json('snapshot_data').notNull(),
  diffFromPrevious: json('diff_from_previous'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const buildArtifacts = pgTable('build_artifacts', {
  id: varchar('id', { length: 36 }).primaryKey(),
  deploymentId: varchar('deployment_id', { length: 36 }).notNull().references(() => deployments.id),
  type: varchar('type', { length: 20 }).notNull(),
  fileName: text('file_name').notNull(),
  filePath: text('file_path').notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  contentType: text('content_type').notNull(),
  storageUrl: text('storage_url'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const webhookEvents = pgTable('webhook_events', {
  id: varchar('id', { length: 36 }).primaryKey(),
  repositoryId: integer('repository_id').references(() => repositories.id),
  eventType: text('event_type').notNull(),
  payload: json('payload').notNull(),
  processed: boolean('processed').notNull().default(false),
  processingError: text('processing_error'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const auditLogs = pgTable('audit_logs', {
  id: varchar('id', { length: 36 }).primaryKey(),
  repositoryId: integer('repository_id').references(() => repositories.id),
  deploymentId: varchar('deployment_id', { length: 36 }).references(() => deployments.id),
  action: text('action').notNull(),
  actor: text('actor'),
  metadata: json('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const repositoryRelations = relations(repositories, ({ many }) => ({
  deployments: many(deployments),
  webhookEvents: many(webhookEvents),
  auditLogs: many(auditLogs)
}));

export const deploymentRelations = relations(deployments, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [deployments.repositoryId],
    references: [repositories.id]
  }),
  snapshots: many(snapshots),
  buildArtifacts: many(buildArtifacts),
  auditLogs: many(auditLogs)
}));

export const snapshotRelations = relations(snapshots, ({ one }) => ({
  deployment: one(deployments, {
    fields: [snapshots.deploymentId],
    references: [deployments.id]
  })
}));

export const buildArtifactRelations = relations(buildArtifacts, ({ one }) => ({
  deployment: one(deployments, {
    fields: [buildArtifacts.deploymentId],
    references: [deployments.id]
  })
})); 