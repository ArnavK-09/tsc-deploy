import {
  pgTable,
  text,
  timestamp,
  integer,
  varchar,
  pgEnum,
} from "drizzle-orm/pg-core";

export const deploymentStatus = pgEnum("deployment_status", [
  "skipped",
  "ready",
  "error",
  "pending",
]);
export const metaType = pgEnum("meta_type", ["push", "pull_request"]);

export const deployments = pgTable("deployments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  owner: text("owner").notNull(),
  repo: text("repo").notNull(),
  commitSha: varchar("commit_sha", { length: 40 }).notNull(),
  status: deploymentStatus("status").default("pending"),
  buildLogs: text("build_logs"),
  errorMessage: text("error_message"),
  meta: text("meta").notNull(),
  metaType: metaType("meta_type").notNull(),
  buildCompletedAt: timestamp("build_completed_at"),
  buildDuration: integer("build_duration"),
  circuitFiles: integer("circuit_count").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
