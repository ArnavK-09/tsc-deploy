import { z } from "zod";

const EnvSchema = z.object({
  GITHUB_BOT_TOKEN: z.string(),
  DATABASE_URL: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  try {
    return EnvSchema.parse(process.env);
  } catch (error) {
    console.error("❌ Invalid environment variables:", error);
    process.exit(1);
  }
}

export const env = loadEnv();
