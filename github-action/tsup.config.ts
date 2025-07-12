import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  outDir: "dist",
  platform: "node",
  target: "node20",
  external: [
    // Node.js built-ins
    "string_decoder",
    "util",
    "fs",
    "path",
    "os",
    "crypto",
    "events",
    "stream",
    "buffer",
    "url",
    "querystring",
    "zlib",
    "http",
    "https",
    "net",
    "tls",
    "child_process",
  ],
  noExternal: [
    // Bundle these dependencies
    "@actions/core",
    "@actions/github",
    "zod",
    "ulid",
    "ky",
  ],
  clean: true,
  minify: false,
  sourcemap: false,
  bundle: true,
  splitting: false,
}); 