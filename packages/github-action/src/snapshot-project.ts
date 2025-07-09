import fs from "node:fs"
import path from "node:path"
import { exec } from "@actions/exec"
import * as core from '@actions/core'

interface SnapshotResult {
  circuitFiles: string[]
  snapshotFiles: string[]
  buildTime: number
  success: boolean
  error?: string
}

export async function snapshotProject(workingDirectory: string): Promise<SnapshotResult> {
  const startTime = Date.now()
  const result: SnapshotResult = {
    circuitFiles: [],
    snapshotFiles: [],
    buildTime: 0,
    success: false
  }

  try {
    core.info('🔍 Finding circuit files...')
    
    // Find circuit files using simple file system operations
    const circuitFiles = await findCircuitFiles(workingDirectory)
    result.circuitFiles = circuitFiles
    
    if (circuitFiles.length === 0) {
      core.warning('⚠️ No circuit files found')
      result.success = true
      result.buildTime = Math.round((Date.now() - startTime) / 1000)
      return result
    }

    core.info(`📋 Found ${circuitFiles.length} circuit file(s): ${circuitFiles.join(', ')}`)

    // Create snapshots directory
    const snapshotsDir = path.join(workingDirectory, '.tscircuit', 'snapshots')
    fs.mkdirSync(snapshotsDir, { recursive: true })

    // Generate snapshots using tscircuit CLI (mock implementation for now)
    for (const circuitFile of circuitFiles) {
      const snapshotFile = await generateSnapshot(circuitFile, snapshotsDir)
      if (snapshotFile) {
        result.snapshotFiles.push(snapshotFile)
      }
    }

    core.info(`✅ Generated ${result.snapshotFiles.length} snapshot(s)`)
    result.success = true
    result.buildTime = Math.round((Date.now() - startTime) / 1000)
    
    return result

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    core.error(`❌ Snapshot generation failed: ${errorMessage}`)
    result.error = errorMessage
    result.buildTime = Math.round((Date.now() - startTime) / 1000)
    return result
  }
}

async function findCircuitFiles(workingDirectory: string): Promise<string[]> {
  const files: string[] = []
  
  try {
    let output = ''
    await exec('find', ['.', '-name', '*.circuit.tsx', '-o', '-name', '*.circuit.ts', '-o', '-name', '*.board.tsx'], {
      cwd: workingDirectory,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString()
        },
      },
    })
    
    const foundFiles = output.trim().split('\n').filter(f => f.length > 0 && f !== '.')
    files.push(...foundFiles)
  } catch (error) {
    core.warning(`Failed to find circuit files with find command: ${error}`)
    
    // Fallback: manual directory traversal
    try {
      const manualFiles = await findCircuitFilesManually(workingDirectory)
      files.push(...manualFiles)
    } catch (fallbackError) {
      core.warning(`Manual file search also failed: ${fallbackError}`)
    }
  }

  return files
}

async function findCircuitFilesManually(dir: string, files: string[] = []): Promise<string[]> {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(process.cwd(), fullPath)
    
    if (entry.isDirectory()) {
      // Skip common ignore patterns
      if (!entry.name.startsWith('.') && 
          entry.name !== 'node_modules' && 
          entry.name !== 'dist' && 
          entry.name !== 'build') {
        await findCircuitFilesManually(fullPath, files)
      }
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.circuit.tsx') || 
          entry.name.endsWith('.circuit.ts') || 
          entry.name.endsWith('.board.tsx')) {
        files.push(relativePath)
      }
    }
  }
  
  return files
}

async function generateSnapshot(circuitFile: string, snapshotsDir: string): Promise<string | null> {
  try {
    const baseName = path.basename(circuitFile, path.extname(circuitFile))
    const snapshotFile = path.join(snapshotsDir, `${baseName}.json`)
    
    // For now, create a simple snapshot metadata file
    // In a real implementation, this would generate actual circuit snapshots
    const snapshotData = {
      file: circuitFile,
      timestamp: new Date().toISOString(),
      type: 'circuit-snapshot',
      // Mock circuit data - in real implementation this would be actual circuit JSON
      mockData: {
        components: [],
        connections: [],
        metadata: {
          name: baseName,
          version: '1.0.0'
        }
      }
    }
    
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshotData, null, 2))
    core.info(`📸 Created snapshot: ${path.relative(process.cwd(), snapshotFile)}`)
    
    return snapshotFile
  } catch (error) {
    core.warning(`Failed to create snapshot for ${circuitFile}: ${error}`)
    return null
  }
}