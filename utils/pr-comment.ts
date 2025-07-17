import { SnapshotResult } from "../shared/types";
import { DEPLOY_URL } from "../shared/constants";

export interface PRCommentData {
  deploymentId: string;
  previewUrl: string;
  buildTime: string;
  circuitCount: number;
  status: "ready" | "error" | "pending";
  snapshotResult: SnapshotResult;
}

export function generatePRComment(data: PRCommentData): string {
  const {
    deploymentId,
    previewUrl,
    buildTime,
    circuitCount,
    status,
    snapshotResult,
  } = data;

  if (status === "error") {
    return `## ❌ tscircuit Deploy Failed

**Deployment ID:** \`${deploymentId}\`
**Build Time:** ${buildTime}
**Error:** ${snapshotResult.error || "Unknown error occurred"}

---
*Powered by [tscircuit](https://tscircuit.com)*`;
  }

  if (status === "pending") {
    return `## 🔄 tscircuit Deploy In Progress

**Deployment ID:** \`${deploymentId}\`
**Status:** Building...

---
*Powered by [tscircuit](https://tscircuit.com)*`;
  }

  let comment = `## ✅ tscircuit Deploy Ready

**🔗 Preview URL:** ${previewUrl}
**⏱️ Build Time:** ${buildTime}
**📊 Circuits:** ${circuitCount}
**🆔 Deployment ID:** \`${deploymentId}\`

`;

  if (circuitCount > 0 && snapshotResult.circuitFiles) {
    comment += `### 🔌 Circuit Files\n\n`;

    snapshotResult.circuitFiles.forEach((file, index) => {
      const fileName = file.name;
      const pcbSvgUrl = `${DEPLOY_URL}/api/svg/${deploymentId}/${index}/pcb?width=300&height=200`;
      const schematicSvgUrl = `${DEPLOY_URL}/api/svg/${deploymentId}/${index}/schematic?width=300&height=200`;
      const pcb3dSvgUrl = `${DEPLOY_URL}/api/svg/${deploymentId}/${index}/3d?width=300&height=200`;

      comment += `<details>
<summary><strong>${fileName}</strong></summary>

#### PCB View
<img src="${pcbSvgUrl}" alt="PCB view of ${fileName}" width="300" />

#### Schematic View  
<img src="${schematicSvgUrl}" alt="Schematic view of ${fileName}" width="300" />

#### 3D View
<img src="${pcb3dSvgUrl}" alt="3D view of ${fileName}" width="300" />

**📈 Circuit Complexity:** ${getCircuitComplexity(file.circuitJson)}
**📏 File Size:** ${file.metadata?.fileSize ? formatBytes(file.metadata.fileSize) : "Unknown"}

</details>

`;
    });
  }

  if (snapshotResult.metadata) {
    comment += `### 📊 Build Metadata

- **Total Files Processed:** ${snapshotResult.metadata.totalFiles}
- **Repository Size:** ${formatBytes(snapshotResult.metadata.repositorySize)}
- **Build Environment:** ${snapshotResult.metadata.buildEnvironment}
- **Build Duration:** ${snapshotResult.buildTime}s

`;
  }

  comment += `### 🔍 View Options

- [🌐 Full Preview](${previewUrl})
- [📋 Deployment Details](${previewUrl}/details)
- [🔗 Share Link](${previewUrl}/share)

---
*Powered by [tscircuit](https://tscircuit.com) • Built with ❤️*`;

  return comment;
}

function getCircuitComplexity(circuitJson: any): string {
  if (!circuitJson) return "Unknown";

  let elementCount = 0;
  if (Array.isArray(circuitJson)) {
    elementCount = circuitJson.length;
  } else if (typeof circuitJson === "object") {
    elementCount = 1;
  }

  if (elementCount > 100) return "High";
  if (elementCount > 20) return "Medium";
  return "Low";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function generateSuccessComment(data: {
  deploymentId: string;
  previewUrl: string;
  buildTime: string;
  circuitCount: number;
}): string {
  return `## ✅ tscircuit Deploy Complete

**🔗 Preview:** ${data.previewUrl}
**⏱️ Time:** ${data.buildTime}
**📊 Circuits:** ${data.circuitCount}

Your circuits are now live! 🎉`;
}

export function generateFailureComment(data: {
  deploymentId: string;
  error: string;
  buildTime: string;
}): string {
  return `## ❌ tscircuit Deploy Failed

**🆔 Deployment:** \`${data.deploymentId}\`
**⏱️ Time:** ${data.buildTime}
**🔍 Error:** ${data.error}

Please check your circuit files and try again.`;
}

export function generateQueuedComment(data: {
  deploymentId: string;
  queuePosition?: number;
}): string {
  const positionText = data.queuePosition
    ? `Position in queue: ${data.queuePosition}`
    : "Queued for processing";

  return `## 🔄 tscircuit Deploy Queued

**🆔 Deployment:** \`${data.deploymentId}\`
**📍 Status:** ${positionText}

Your build will start shortly...`;
}
