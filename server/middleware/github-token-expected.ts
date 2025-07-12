import { Context, Next } from "hono";

async function verifyGitHubToken(token: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "tscircuit-deploy-bot",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Error verifying GitHub token:", error);
    return false;
  }
}

export async function expectedGithubToken(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized - Bearer token required" }, 401);
  }

  const token = authHeader.substring(7);

  const isValid = await verifyGitHubToken(token);
  if (!isValid) {
    return c.json({ error: "Invalid GitHub token" }, 401);
  }

  c.set("githubToken", token);
  await next();
}

export async function optionalGithubToken(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const isValid = await verifyGitHubToken(token);

    if (isValid) {
      c.set("githubToken", token);
    }
  }

  await next();
}

export const apiAuth = expectedGithubToken;
