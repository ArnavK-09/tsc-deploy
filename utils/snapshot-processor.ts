import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { CircuitRunner } from "tscircuit";
import { createHash } from "node:crypto";
import { SnapshotResult, CircuitFile } from "../shared/types";

const execAsync = promisify(exec);
const ALLOWED_FILE_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js"];

export interface BuildProgress {
  stage: string;
  progress: number;
  message: string;
  timestamp: Date;
}

export class SnapshotProcessor {
  private workingDirectory: string;
  private onProgress?: (progress: BuildProgress) => void;

  constructor(workingDirectory: string, onProgress?: (progress: BuildProgress) => void) {
    this.workingDirectory = workingDirectory;
    this.onProgress = onProgress;
  }

  private updateProgress(stage: string, progress: number, message: string) {
    if (this.onProgress) {
      this.onProgress({
        stage,
        progress,
        message,
        timestamp: new Date(),
      });
    }
  }

  async findCircuitFiles(): Promise<string[]> {
    this.updateProgress("discovery", 10, "Finding circuit files...");
    const files: string[] = [];

    try {
      const { stdout } = await execAsync(
        'find . -name "*.circuit.tsx" -o -name "*.circuit.ts" -o -name "*.board.tsx"',
        { cwd: this.workingDirectory }
      );

      const foundFiles = stdout
        .trim()
        .split("\n")
        .filter((f) => f.length > 0 && f !== ".");
      files.push(...foundFiles);
    } catch (error) {
      console.warn(`Failed to find circuit files with find command: ${error}`);
      
      try {
        const manualFiles = await this.findCircuitFilesManually(this.workingDirectory);
        files.push(...manualFiles);
      } catch (fallbackError) {
        console.warn(`Manual file search also failed: ${fallbackError}`);
      }
    }

    this.updateProgress("discovery", 20, `Found ${files.length} circuit files`);
    return files;
  }

  private async findCircuitFilesManually(dir: string, files: string[] = []): Promise<string[]> {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath);

      if (entry.isDirectory()) {
        if (
          !entry.name.startsWith(".") &&
          entry.name !== "node_modules" &&
          entry.name !== "dist" &&
          entry.name !== "build"
        ) {
          await this.findCircuitFilesManually(fullPath, files);
        }
      } else if (entry.isFile()) {
        if (
          entry.name.endsWith(".circuit.tsx") ||
          entry.name.endsWith(".circuit.ts") ||
          entry.name.endsWith(".board.tsx")
        ) {
          files.push(relativePath);
        }
      }
    }

    return files;
  }

  private async generateCircuitJson(filePath: string): Promise<any> {
    this.updateProgress("processing", 0, `Generating circuit JSON for ${filePath}`);

    try {
      const absoluteFilePath = path.resolve(this.workingDirectory, filePath);

      if (!fs.existsSync(absoluteFilePath)) {
        throw new Error(`Circuit file not found: ${absoluteFilePath}`);
      }

      const runner = new CircuitRunner();
      const projectDir = path.dirname(absoluteFilePath);
      const relativeComponentPath = path.relative(projectDir, absoluteFilePath);

      const fsMap: Record<string, string> = {};

      fsMap[relativeComponentPath] = fs.readFileSync(absoluteFilePath, "utf-8");

      const packageJsonPath = path.join(projectDir, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        fsMap["package.json"] = fs.readFileSync(packageJsonPath, "utf-8");
      }

      this.readProjectFiles(projectDir, projectDir, fsMap);

      this.updateProgress("processing", 30, `Loaded ${Object.keys(fsMap).length} files into virtual file system`);

      await runner.executeWithFsMap({
        fsMap,
        mainComponentPath: relativeComponentPath,
      });

      this.updateProgress("processing", 60, "Rendering circuit...");
      await runner.renderUntilSettled();

      this.updateProgress("processing", 80, "Extracting circuit JSON...");
      const circuitJson = await runner.getCircuitJson();

      if (!circuitJson || (Array.isArray(circuitJson) && circuitJson.length === 0)) {
        throw new Error("No circuit data was generated");
      }

      this.updateProgress("processing", 90, "Circuit JSON generated successfully");
      return circuitJson;
    } catch (error) {
      throw new Error(`Failed to generate circuit JSON: ${error}`);
    }
  }

  private readProjectFiles(dir: string, baseDir: string, fsMap: Record<string, string>) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {
          if (
            !entry.name.startsWith(".") &&
            entry.name !== "node_modules" &&
            entry.name !== "dist" &&
            entry.name !== "build" &&
            entry.name !== ".tscircuit"
          ) {
            this.readProjectFiles(fullPath, baseDir, fsMap);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (ALLOWED_FILE_EXTENSIONS.includes(ext)) {
            try {
              fsMap[relativePath] = fs.readFileSync(fullPath, "utf-8");
            } catch (error) {
              console.warn(`Failed to read file ${relativePath}: ${error}`);
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Failed to read directory ${dir}: ${error}`);
    }
  }

  private async getFileMetadata(filePath: string): Promise<{
    fileSize: number;
    lastModified: string;
    checksum: string;
  }> {
    const absolutePath = path.resolve(this.workingDirectory, filePath);
    const stats = fs.statSync(absolutePath);
    const content = fs.readFileSync(absolutePath, "utf-8");
    const checksum = createHash("sha256").update(content).digest("hex");

    return {
      fileSize: stats.size,
      lastModified: stats.mtime.toISOString(),
      checksum,
    };
  }

  private async getRepositorySize(): Promise<number> {
    try {
      const { FileHandler } = await import("./file-handler");
      return await FileHandler.getDirectorySize(this.workingDirectory);
    } catch {
      return 0;
    }
  }

  async generateSnapshot(): Promise<SnapshotResult> {
    const startTime = Date.now();
    const result: SnapshotResult = {
      circuitFiles: [],
      buildTime: 0,
      success: false,
    };

    try {
      this.updateProgress("init", 5, "Starting snapshot generation...");
      
      const circuitFiles = await this.findCircuitFiles();
      
      if (circuitFiles.length === 0) {
        this.updateProgress("complete", 100, "No circuit files found");
        result.success = true;
        result.buildTime = Math.round((Date.now() - startTime) / 1000);
        result.metadata = {
          totalFiles: 0,
          repositorySize: await this.getRepositorySize(),
          buildEnvironment: process.env.NODE_ENV || "production",
        };
        return result;
      }

      this.updateProgress("processing", 25, `Processing ${circuitFiles.length} circuit files...`);

      const totalFiles = circuitFiles.length;
      result.circuitFiles = await Promise.all(
        circuitFiles.map(async (file, index) => {
          const fileProgress = Math.round(((index + 1) / totalFiles) * 70) + 25;
          this.updateProgress("processing", fileProgress, `Processing ${file}`);
          
          const circuitJson = await this.generateCircuitJson(file);
          const metadata = await this.getFileMetadata(file);
          
          const circuitFile: CircuitFile = {
            path: file,
            name: path.basename(file),
            circuitJson,
            metadata,
          };
          
          return circuitFile;
        })
      );

      this.updateProgress("complete", 100, `Successfully processed ${circuitFiles.length} circuit files`);
      result.success = true;
      result.buildTime = Math.round((Date.now() - startTime) / 1000);
      result.metadata = {
        totalFiles: circuitFiles.length,
        repositorySize: await this.getRepositorySize(),
        buildEnvironment: process.env.NODE_ENV || "production",
      };

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.updateProgress("error", 0, `Snapshot generation failed: ${errorMessage}`);
      result.error = errorMessage;
      result.buildTime = Math.round((Date.now() - startTime) / 1000);
      return result;
    }
  }
} 