/**
 * Import the 'handle' function from the 'hono/vercel' package.
 * This function is used to create a request handler for the Vercel platform.
 */
import { handle } from "hono/vercel";

/**
 * Import the 'app' instance from the server source.
 * This instance represents the application logic and routes.
 */
import { app } from "../src/index.js";

/**
 * Create a request handler using the 'handle' function.
 * This function wraps the application instance to handle HTTP requests.
 */
const handler = handle(app);

/**
 * Export the request handler functions for different HTTP methods.
 * This allows the Vercel platform to route requests to the appropriate handler.
 */
export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const OPTIONS = handler; 