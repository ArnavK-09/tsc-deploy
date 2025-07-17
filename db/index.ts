import { drizzle } from "drizzle-orm/vercel-postgres";
import { sql } from "@vercel/postgres";
import { deployments, buildJobs, buildArtifacts } from "./schema";

export const db = drizzle(sql);

export { deployments, buildJobs, buildArtifacts };

export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
export type BuildJob = typeof buildJobs.$inferSelect;
export type NewBuildJob = typeof buildJobs.$inferInsert;
export type BuildArtifact = typeof buildArtifacts.$inferSelect;
export type NewBuildArtifact = typeof buildArtifacts.$inferInsert;
