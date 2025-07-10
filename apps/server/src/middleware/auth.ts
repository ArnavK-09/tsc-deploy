import { Context, Next } from "hono";
import { env } from "../config/env";

export async function apiAuth(c: Context, next: Next) {
  if (!env.API_SECRET) {
    await next();
    return;
  }

  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.substring(7);

  if (token !== env.API_SECRET) {
    return c.json({ error: "Invalid token" }, 401);
  }

  await next();
}

export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    c.set("authToken", token);
  }

  await next();
}
