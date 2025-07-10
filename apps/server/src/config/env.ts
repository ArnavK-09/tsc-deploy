import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.string().default("3001").transform(Number),
  GITHUB_BOT_TOKEN: z.string(),
  GITHUB_APP_TOKEN: z.string().optional(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  API_SECRET: z.string().optional(),
  DATABASE_URL: z.string().optional(),
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
