import { BuildContext, DeploymentResult } from "@tscircuit-deploy/shared/types";
import {
  db,
  deployments,
  snapshots,
  buildArtifacts,
} from "@tscircuit-deploy/shared/db";
import { eq } from "drizzle-orm";
import {
  generateDeploymentId,
  generatePreviewUrl,
  formatBuildTime,
} from "@tscircuit-deploy/shared/utils";

export class BuildService {
  private buildQueue: Map<string, BuildContext> = new Map();

  async startBuild(context: BuildContext): Promise<string> {
    const deploymentId = generateDeploymentId();

    this.buildQueue.set(deploymentId, context);

    try {
      await db
        .update(deployments)
        .set({
          status: "building",
          buildStartedAt: new Date(),
        })
        .where(eq(deployments.repositoryId, context.repositoryId));

      const result = await this.processBuild(deploymentId, context);

      if (result.success) {
        await this.handleBuildSuccess(deploymentId, result);
      } else {
        await this.handleBuildFailure(
          deploymentId,
          result.errorMessage || "Unknown build error",
        );
      }

      return deploymentId;
    } catch (error) {
      console.error(`Build failed for deployment ${deploymentId}:`, error);
      await this.handleBuildFailure(
        deploymentId,
        error instanceof Error ? error.message : "Build process failed",
      );
      throw error;
    } finally {
      this.buildQueue.delete(deploymentId);
    }
  }

  private async processBuild(
    deploymentId: string,
    context: BuildContext,
  ): Promise<DeploymentResult> {
    const startTime = new Date();
    const artifacts: any[] = [];

    try {
      console.log(`Starting build for deployment ${deploymentId}`);
      console.log(`Processing ${context.circuitFiles.length} circuit files`);

      for (const circuitFile of context.circuitFiles) {
        console.log(`Building circuit: ${circuitFile.path}`);

        const snapshot = await this.buildCircuitSnapshot(
          deploymentId,
          circuitFile,
        );
        artifacts.push(
          ...(await this.generateArtifacts(
            deploymentId,
            circuitFile,
            snapshot,
          )),
        );
      }

      const endTime = new Date();
      const buildTime = endTime.getTime() - startTime.getTime();

      return {
        success: true,
        deploymentId,
        previewUrl: generatePreviewUrl(deploymentId),
        buildTime,
        artifacts,
      };
    } catch (error) {
      console.error(`Build processing failed for ${deploymentId}:`, error);
      return {
        success: false,
        deploymentId,
        errorMessage:
          error instanceof Error ? error.message : "Build processing failed",
        buildTime: new Date().getTime() - startTime.getTime(),
        artifacts,
      };
    }
  }

  private async buildCircuitSnapshot(
    deploymentId: string,
    circuitFile: { path: string; content: string; sha: string },
  ) {
    try {
      const snapshotData = await this.executeCircuitBuild(circuitFile.content);

      const snapshotId = generateDeploymentId();
      await db.insert(snapshots).values({
        id: snapshotId,
        deploymentId,
        circuitPath: circuitFile.path,
        snapshotData,
      });

      return { id: snapshotId, data: snapshotData };
    } catch (error) {
      console.error(`Failed to build snapshot for ${circuitFile.path}:`, error);
      throw error;
    }
  }

  private async executeCircuitBuild(
    circuitContent: string,
  ): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      try {
        const mockSnapshot = {
          type: "circuit",
          components: [],
          connections: [],
          pcb: {
            width: 20,
            height: 20,
            layers: 2,
          },
          schematic: {
            symbols: [],
            nets: [],
          },
          timestamp: new Date().toISOString(),
        };

        setTimeout(
          () => {
            resolve(mockSnapshot);
          },
          Math.random() * 2000 + 1000,
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  private async generateArtifacts(
    deploymentId: string,
    circuitFile: any,
    snapshot: any,
  ) {
    const artifacts = [];
    const artifactTypes = ["pcb", "schematic", "bom", "gerber"];

    for (const type of artifactTypes) {
      try {
        const artifactId = generateDeploymentId();
        const fileName = `${circuitFile.path.replace(/\.circuit\.tsx$/, "")}_${type}.json`;
        const filePath = `/artifacts/${deploymentId}/${fileName}`;

        const artifactData = await this.generateArtifactData(
          type,
          snapshot.data,
        );
        const fileSize = JSON.stringify(artifactData).length;

        await db.insert(buildArtifacts).values({
          id: artifactId,
          deploymentId,
          type: type as any,
          fileName,
          filePath,
          fileSize,
          contentType: "application/json",
          storageUrl: `https://storage.tscircuit.com${filePath}`,
        });

        artifacts.push({
          id: artifactId,
          type,
          fileName,
          filePath,
          fileSize,
          contentType: "application/json",
        });
      } catch (error) {
        console.error(`Failed to generate ${type} artifact:`, error);
      }
    }

    return artifacts;
  }

  private async generateArtifactData(type: string, snapshotData: any) {
    switch (type) {
      case "pcb":
        return {
          type: "pcb",
          layers: snapshotData.pcb?.layers || 2,
          dimensions: snapshotData.pcb || { width: 20, height: 20 },
          traces: [],
          vias: [],
          pads: [],
        };
      case "schematic":
        return {
          type: "schematic",
          symbols: snapshotData.schematic?.symbols || [],
          nets: snapshotData.schematic?.nets || [],
          title: "Generated Schematic",
        };
      case "bom":
        return {
          type: "bom",
          components: snapshotData.components || [],
          totalCost: 0,
          currency: "USD",
        };
      case "gerber":
        return {
          type: "gerber",
          files: [
            "copper_top.gbr",
            "copper_bottom.gbr",
            "soldermask_top.gts",
            "soldermask_bottom.gbs",
          ],
          drillFile: "drill.txt",
        };
      default:
        return { type, data: snapshotData };
    }
  }

  private async handleBuildSuccess(
    deploymentId: string,
    result: DeploymentResult,
  ) {
    try {
      const deployment = await db
        .select()
        .from(deployments)
        .where(eq(deployments.id, deploymentId))
        .limit(1);

      if (deployment.length === 0) {
        throw new Error(`Deployment ${deploymentId} not found`);
      }

      const buildDuration = result.buildTime;

      await db
        .update(deployments)
        .set({
          status: "ready",
          previewUrl: result.previewUrl,
          buildCompletedAt: new Date(),
          buildDuration,
        })
        .where(eq(deployments.id, deploymentId));

      console.log(
        `Build completed successfully for deployment ${deploymentId}`,
      );
      console.log(`Preview URL: ${result.previewUrl}`);
      console.log(
        `Build time: ${formatBuildTime(new Date(Date.now() - buildDuration), new Date())}`,
      );
    } catch (error) {
      console.error(
        `Failed to handle build success for ${deploymentId}:`,
        error,
      );
      throw error;
    }
  }

  private async handleBuildFailure(deploymentId: string, errorMessage: string) {
    try {
      await db
        .update(deployments)
        .set({
          status: "error",
          errorMessage,
          buildCompletedAt: new Date(),
        })
        .where(eq(deployments.id, deploymentId));

      console.error(
        `Build failed for deployment ${deploymentId}: ${errorMessage}`,
      );
    } catch (error) {
      console.error(
        `Failed to handle build failure for ${deploymentId}:`,
        error,
      );
      throw error;
    }
  }

  getBuildStatus(deploymentId: string) {
    return this.buildQueue.has(deploymentId) ? "building" : "unknown";
  }

  getQueueSize(): number {
    return this.buildQueue.size;
  }
}
