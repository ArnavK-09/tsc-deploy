import { createHash, randomUUID } from "crypto";

export function generateDeploymentId(): string {
  return randomUUID();
}

export function generatePreviewUrl(
  deploymentId: string,
  domain = "preview.tscircuit.com",
): string {
  return `https://${deploymentId}.${domain}`;
}

export function generatePackageVersion(
  currentVersion: string,
  type: "patch" | "minor" | "major" = "patch",
): string {
  const [major, minor, patch] = currentVersion.split(".").map(Number);

  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

export function createCommitHash(content: string): string {
  return createHash("sha1").update(content).digest("hex");
}

export function formatBuildTime(startTime: Date, endTime: Date): string {
  const duration = endTime.getTime() - startTime.getTime();
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function extractCircuitFiles(
  files: Array<{ path: string; content: string }>,
): Array<{ path: string; content: string }> {
  return files.filter(
    (file) =>
      file.path.endsWith(".circuit.tsx") ||
      (file.path.includes(".circuit.") && file.path.endsWith(".tsx")),
  );
}

export function createPRComment(data: {
  deploymentId: string;
  previewUrl: string;
  buildTime: string;
  circuitCount: number;
  status: string;
  commitSha: string;
}): string {
  const {
    deploymentId,
    previewUrl,
    buildTime,
    circuitCount,
    status,
    commitSha,
  } = data;

  const statusEmoji =
    {
      ready: "✅",
      building: "🔄",
      error: "❌",
      pending: "⏳",
      cancelled: "🚫",
    }[status] || "❓";

  return `## ${statusEmoji} tscircuit Deploy

**${status === "ready" ? "Preview Deploy" : "Deployment Status"}**: ${status}

${status === "ready" ? `🔗 **Preview URL**: ${previewUrl}` : ""}
📊 **Circuits Found**: ${circuitCount}
⏱️ **Build Time**: ${buildTime}
🔧 **Commit**: \`${commitSha.substring(0, 7)}\`

${
  status === "ready"
    ? `
### What's Included
- Interactive circuit previews
- PCB and schematic views
- Component bill of materials
- Gerber files for manufacturing

[View deployment details →](${previewUrl}/deployment/${deploymentId})
`
    : ""
}

---
*Powered by [tscircuit Deploy](https://tscircuit.com)*`;
}

export function validateCircuitFile(content: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!content.includes("circuit")) {
    errors.push("File must export a circuit component");
  }

  if (!content.includes("export") && !content.includes("default")) {
    errors.push("File must have a default export or named circuit export");
  }

  try {
    if (content.includes("import") && !content.includes("@tscircuit/core")) {
      errors.push(
        "Consider importing from @tscircuit/core for better compatibility",
      );
    }
  } catch (e) {
    errors.push("Unable to parse imports");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function parseSemanticCommit(message: string): {
  type: "patch" | "minor" | "major";
  scope?: string;
} {
  const conventionalCommitRegex =
    /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?(!)?:/;
  const match = message.match(conventionalCommitRegex);

  if (!match) {
    return { type: "patch" };
  }

  const [, type, scope, breaking] = match;

  if (breaking === "!" || message.toLowerCase().includes("breaking change")) {
    return { type: "major", scope: scope?.slice(1, -1) };
  }

  if (type === "feat") {
    return { type: "minor", scope: scope?.slice(1, -1) };
  }

  return { type: "patch", scope: scope?.slice(1, -1) };
}

export function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const attempt = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        attempts++;

        if (attempts >= maxRetries) {
          reject(error);
          return;
        }

        const delay = baseDelay * Math.pow(2, attempts - 1);
        setTimeout(attempt, delay);
      }
    };

    attempt();
  });
}

import micromatch from "micromatch";

/** Default directories and patterns ignored by the CLI */
export const DEFAULT_IGNORED_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.vscode/**",
  // Ignore any directory that starts with a dot
  "**/.*/*",
  // Ignore dotfiles at the project root such as .env
  "**/.*",
];

export const normalizeIgnorePattern = (pattern: string) => {
  // If the pattern already contains glob characters assume it's complete
  if (/[\*\?\[\]\{\}]/.test(pattern)) return pattern;
  // Otherwise treat it as a directory name
  return `**/${pattern}/**`;
};

export const shouldIgnorePath = (
  relativePath: string,
  configIgnored: string[] = [],
): boolean => {
  const extraPatterns = configIgnored.map(normalizeIgnorePattern);
  return micromatch.isMatch(relativePath, [
    ...DEFAULT_IGNORED_PATTERNS,
    ...extraPatterns,
  ]);
};

