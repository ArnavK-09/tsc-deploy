import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

export interface FileChunk {
  id: string;
  index: number;
  totalChunks: number;
  data: Buffer;
  checksum: string;
}

export interface LargeFileMetadata {
  fileName: string;
  totalSize: number;
  totalChunks: number;
  checksum: string;
  mimeType?: string;
}

export class FileHandler {
  private static readonly CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  private static readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max

  static async validateFileSize(filePath: string): Promise<boolean> {
    try {
      const stats = fs.statSync(filePath);
      return stats.size <= this.MAX_FILE_SIZE;
    } catch {
      return false;
    }
  }

  static async getFileMetadata(filePath: string): Promise<LargeFileMetadata> {
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const totalSize = stats.size;
    const totalChunks = Math.ceil(totalSize / this.CHUNK_SIZE);
    
    // Calculate file checksum
    const hash = createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => {
        const checksum = hash.digest('hex');
        resolve({
          fileName,
          totalSize,
          totalChunks,
          checksum,
        });
      });
      stream.on('error', reject);
    });
  }

  static async* chunkFile(filePath: string): AsyncGenerator<FileChunk> {
    const metadata = await this.getFileMetadata(filePath);
    const fileDescriptor = fs.openSync(filePath, 'r');
    
    try {
      for (let i = 0; i < metadata.totalChunks; i++) {
        const buffer = Buffer.alloc(this.CHUNK_SIZE);
        const position = i * this.CHUNK_SIZE;
        const bytesRead = fs.readSync(fileDescriptor, buffer, 0, this.CHUNK_SIZE, position);
        
        const chunkData = buffer.subarray(0, bytesRead);
        const chunkHash = createHash('sha256').update(chunkData).digest('hex');
        
        yield {
          id: `${metadata.checksum}_${i}`,
          index: i,
          totalChunks: metadata.totalChunks,
          data: chunkData,
          checksum: chunkHash,
        };
      }
    } finally {
      fs.closeSync(fileDescriptor);
    }
  }

  static async assembleFile(chunks: FileChunk[], outputPath: string): Promise<boolean> {
    if (chunks.length === 0) return false;

    // Sort chunks by index
    chunks.sort((a, b) => a.index - b.index);

    // Validate chunk sequence
    const expectedTotalChunks = chunks[0].totalChunks;
    if (chunks.length !== expectedTotalChunks) {
      throw new Error(`Missing chunks: expected ${expectedTotalChunks}, got ${chunks.length}`);
    }

    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].index !== i) {
        throw new Error(`Chunk sequence error: expected index ${i}, got ${chunks[i].index}`);
      }
    }

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });

    // Write chunks to file
    const writeStream = fs.createWriteStream(outputPath);
    
    return new Promise((resolve, reject) => {
      let currentIndex = 0;
      
      const writeNextChunk = () => {
        if (currentIndex >= chunks.length) {
          writeStream.end();
          return;
        }
        
        const chunk = chunks[currentIndex];
        writeStream.write(chunk.data, (error) => {
          if (error) {
            reject(error);
            return;
          }
          
          currentIndex++;
          writeNextChunk();
        });
      };
      
      writeStream.on('finish', () => resolve(true));
      writeStream.on('error', reject);
      
      writeNextChunk();
    });
  }

  static async compressDirectory(dirPath: string, outputPath: string): Promise<void> {
    try {
      // Try using Node.js tar package if available
      const tar = await import("tar").catch(() => null);
      
      if (tar) {
        await tar.create({
          file: outputPath,
          gzip: true,
          cwd: path.dirname(dirPath),
        }, [path.basename(dirPath)]);
      } else {
        // Fallback to shell command
        const { exec } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execAsync = promisify(exec);

        const tarCommand = `tar -czf "${outputPath}" -C "${path.dirname(dirPath)}" "${path.basename(dirPath)}"`;
        await execAsync(tarCommand);
      }
    } catch (error) {
      throw new Error(`Failed to compress directory: ${error}`);
    }
  }

  static async extractArchive(archivePath: string, outputDir: string): Promise<void> {
    try {
      // Try using Node.js built-in tar extraction if available
      const tar = await import("tar").catch(() => null);
      
      if (tar) {
        // Use tar package for extraction
        await tar.extract({
          file: archivePath,
          cwd: outputDir,
          strip: 0,
        });
      } else {
        // Fallback to shell command
        const { exec } = await import("node:child_process");
        const { promisify } = await import("node:util");
        const execAsync = promisify(exec);

        fs.mkdirSync(outputDir, { recursive: true });
        
        const extractCommand = `tar -xzf "${archivePath}" -C "${outputDir}"`;
        await execAsync(extractCommand);
      }
    } catch (error) {
      throw new Error(`Failed to extract archive: ${error}`);
    }
  }

  static getTemporaryPath(prefix: string = "temp"): string {
    const randomId = Math.random().toString(36).substring(2, 15);
    return path.join("/tmp", `${prefix}_${randomId}`);
  }

  static async cleanup(paths: string[]): Promise<void> {
    for (const filePath of paths) {
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(filePath);
          }
        }
      } catch (error) {
        console.warn(`Failed to cleanup ${filePath}:`, error);
      }
    }
  }

  static async createSymbolicLink(target: string, linkPath: string): Promise<void> {
    const linkDir = path.dirname(linkPath);
    fs.mkdirSync(linkDir, { recursive: true });
    
    if (fs.existsSync(linkPath)) {
      fs.unlinkSync(linkPath);
    }
    
    fs.symlinkSync(target, linkPath);
  }

  static async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    const getSize = (currentPath: string) => {
      const stats = fs.statSync(currentPath);
      
      if (stats.isDirectory()) {
        const files = fs.readdirSync(currentPath);
        for (const file of files) {
          getSize(path.join(currentPath, file));
        }
      } else {
        totalSize += stats.size;
      }
    };
    
    getSize(dirPath);
    return totalSize;
  }
} 