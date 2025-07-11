import { SnapshotResult } from "@tscircuit-deploy/shared/types";

export function createDeploymentTable(data: {
  deploymentId: string;
  previewUrl: string;
  buildTime: string;
  circuitCount: number;
  status: "ready" | "error" | "skipped";
}): string {
  const { deploymentId, previewUrl, circuitCount, status } = data;

  const statusDisplay = {
    ready: "✅ Ready",
    error: "❌ Failed",
    skipped: "⏭️ Skipped",
  }[status];

  const inspectUrl = `${previewUrl}/inspect`;
  const currentTime = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return `
## ✨ tscircuit deploy

| Deploment ID | Status | Preview | Circuits | Updated |
| :--- | :----- | :------ | :------- | :------ |
| **${deploymentId.replace("deployment-", "")}** | ${statusDisplay} ([Inspect](${inspectUrl})) | ${status === "ready" ? `[Visit Preview](${previewUrl})` : "—"} | ${circuitCount} files | ${currentTime} |`.trim();
}

export function createImagePreviewTable(
  circuitFiles: SnapshotResult["circuitFiles"],
): string {
  if (!circuitFiles.length) return "";

  const circuitGroups = new Map<string, typeof circuitFiles>();

  circuitFiles.forEach((file) => {
    if (!circuitGroups.has(file.name)) {
      circuitGroups.set(file.name, []);
    }
    circuitGroups.get(file.name)!.push(file);
  });

  const tableRows = Array.from(circuitGroups.entries())
    .map(([circuitName]) => {
      const pcbSvg = circuitGroups.get(circuitName)?.[0]?.svg.pcb;
      const schematicSvg = circuitGroups.get(circuitName)?.[0]?.svg.schematic;

      const pcbCell = `<img src="${encodeURIComponent(pcbSvg || "")}" alt="PCB" width="120" height="80" />`;
      const schematicCell = `<img src="${encodeURIComponent(schematicSvg || "")}" alt="Schematic" width="120" height="80" />`;

      return `| **${circuitGroups.get(circuitName)?.[0]?.name}** | ${pcbCell} | ${schematicCell} |`;
    })
    .join("\n");

  return `
## 📸 Circuit Previews

| Circuit | PCB | Schematic |
| :------ | :-: | :-------: |
${tableRows}`;
}

export function generatePRComment(data: {
  deploymentId: string;
  previewUrl: string;
  buildTime: string;
  circuitCount: number;
  status: "ready" | "error" | "skipped";
  snapshotResult: SnapshotResult;
}): string {
  const {
    deploymentId,
    previewUrl,
    buildTime,
    circuitCount,
    status,
    snapshotResult,
  } = data;

  const deploymentTable = createDeploymentTable({
    deploymentId,
    previewUrl,
    buildTime,
    circuitCount,
    status,
  });

  const imagePreviewTable =
    snapshotResult.circuitFiles.length > 0
      ? createImagePreviewTable(snapshotResult.circuitFiles)
      : "";

  return `

${deploymentTable}

${imagePreviewTable}

---
*🤖 Automated deployment by [tscircuit](https://tscircuit.com)*`;
}
