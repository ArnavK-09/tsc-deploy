/**
 * Import the 'handle' function from the 'hono/vercel' package.
 * This function is used to create a request handler for the Vercel platform.
 */
const { handle } = require("hono/vercel");

/**
 * Import the 'app' instance from the server source.
 * This instance represents the application logic and routes.
 */
const { app } = require("../apps/server/src/index");

/**
 * Create a request handler using the 'handle' function.
 * This function wraps the application instance to handle HTTP requests.
 */
const handler = handle(app);

/**
 * Export the request handler functions for different HTTP methods.
 * This allows the Vercel platform to route requests to the appropriate handler.
 */
exports.GET = handler;
exports.POST = handler;
exports.PATCH = handler;
exports.PUT = handler;
exports.OPTIONS = handler;
