import fs from "node:fs"
import path from "node:path"
import { exec } from "@actions/exec"
import * as core from '@actions/core'
import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg"
import { convertCircuitJsonToSimple3dSvg } from "circuit-json-to-simple-3d"
import { CircuitRunner } from "tscircuit"
import { relative } from "node:path"

const ALLOWED_FILE_EXTENSIONS = [
  ".tsx", ".ts", ".jsx", ".js",
]

type GenerateCircuitJsonOptions = {
  filePath: string
  outputDir?: string
  outputFileName?: string
  saveToFile?: boolean
}

/**
 * Generates circuit JSON from a TSCircuit component file
 * Similar to the tscircuit CLI functionality
 */
export async function generateCircuitJsonStandalone({
  filePath,
  outputDir,
  outputFileName,
  saveToFile = false,
}: GenerateCircuitJsonOptions) {
  // TODO: Implement real CircuitRunner usage
  throw new Error('CircuitRunner integration not yet implemented - use mock for now')
}

interface SnapshotResult {
  circuitFiles: string[]
  svgFiles: string[]
  buildTime: number
  success: boolean
  error?: string
}

interface CircuitSnapshot {
  name: string
  pcbSvg: string
  schematicSvg: string
  threeDSvg: string
}

interface SvgPreview {
  name: string
  type: 'pcb' | 'schematic' | '3d'
  svgContent: string
  filePath: string
}

export async function getSvgPreviews(snapshotResult: SnapshotResult): Promise<SvgPreview[]> {
  const previews: SvgPreview[] = []
  
  for (const svgFile of snapshotResult.svgFiles) {
    try {
      const svgContent = fs.readFileSync(svgFile, 'utf-8')
      const fileName = path.basename(svgFile)
      const baseName = fileName.replace(/-(pcb|schematic|3d)\.svg$/, '')
      const type = fileName.includes('-pcb.svg') ? 'pcb' 
                 : fileName.includes('-schematic.svg') ? 'schematic'
                 : '3d'
      
      previews.push({
        name: baseName,
        type,
        svgContent,
        filePath: svgFile
      })
    } catch (error) {
      core.warning(`Failed to read SVG file ${svgFile}: ${error}`)
    }
  }
  
  return previews
}

export async function snapshotProject(workingDirectory: string): Promise<SnapshotResult> {
  const startTime = Date.now()
  const result: SnapshotResult = {
    circuitFiles: [],
    svgFiles: [],
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

    // Generate SVG snapshots for each circuit file
    for (const circuitFile of circuitFiles) {
      try {
        const svgFiles = await generateCircuitSvgs(circuitFile, snapshotsDir, workingDirectory)
        result.svgFiles.push(...svgFiles)
      } catch (error) {
        core.warning(`Failed to generate SVGs for ${circuitFile}: ${error}`)
        // Continue with other files
      }
    }

    core.info(`✅ Generated ${result.svgFiles.length} SVG snapshot(s)`)
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

async function generateCircuitJson(filePath: string, workingDirectory: string): Promise<any> {
  core.info(`🔧 Generating circuit JSON for ${filePath}`)
  
  try {
    const absoluteFilePath = path.resolve(workingDirectory, filePath)
    
    if (!fs.existsSync(absoluteFilePath)) {
      throw new Error(`Circuit file not found: ${absoluteFilePath}`)
    }
    
    core.info(`📄 Processing circuit file: ${absoluteFilePath}`)
    
    core.info(`📄 Processing circuit file: ${absoluteFilePath}`)
    const runner = new CircuitRunner()
    const projectDir = path.dirname(absoluteFilePath)
    const relativeComponentPath = relative(projectDir, absoluteFilePath)
    
    // Create a simplified virtual file system by reading project files
    const fsMap: Record<string, string> = {}
    
    // Read the main circuit file
    fsMap[relativeComponentPath] = fs.readFileSync(absoluteFilePath, 'utf-8')
    
    // Read package.json if it exists for dependencies
    const packageJsonPath = path.join(projectDir, 'package.json')
    if (fs.existsSync(packageJsonPath)) {
      fsMap['package.json'] = fs.readFileSync(packageJsonPath, 'utf-8')
    }
    
    // Recursively read project files (excluding node_modules, dist, etc.)
    const readProjectFiles = (dir: string, baseDir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          const relativePath = path.relative(baseDir, fullPath)
          
          if (entry.isDirectory()) {
            // Skip common ignore patterns
            if (!entry.name.startsWith('.') && 
                entry.name !== 'node_modules' && 
                entry.name !== 'dist' && 
                entry.name !== 'build' &&
                entry.name !== '.tscircuit') {
              readProjectFiles(fullPath, baseDir)
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name)
            if (ALLOWED_FILE_EXTENSIONS.includes(ext)) {
              try {
                fsMap[relativePath] = fs.readFileSync(fullPath, 'utf-8')
              } catch (error) {
                core.warning(`Failed to read file ${relativePath}: ${error}`)
              }
            }
          }
        }
      } catch (error) {
        core.warning(`Failed to read directory ${dir}: ${error}`)
      }
    }
    
    readProjectFiles(projectDir, projectDir)
    
    core.info(`📂 Loaded ${Object.keys(fsMap).length} files into virtual file system`)
    
    // Execute the circuit runner
    await runner.executeWithFsMap({
      fsMap,
      mainComponentPath: relativeComponentPath,
    })
    
    // Wait for the circuit to be fully rendered
    await runner.renderUntilSettled()
    
    // Get the circuit JSON
    const circuitJson = await runner.getCircuitJson()
    
    if (!circuitJson || (Array.isArray(circuitJson) && circuitJson.length === 0)) {
      throw new Error('No circuit data was generated')
    }
    
    core.info(`✅ Generated circuit JSON with ${Array.isArray(circuitJson) ? circuitJson.length : 'unknown'} elements`)
    
    return circuitJson
  } catch (error) {
    core.error(`❌ Failed to generate circuit JSON: ${error}`)
    throw error
  }
}

async function generateCircuitSvgs(circuitFile: string, snapshotsDir: string, workingDirectory: string): Promise<string[]> {
  const svgFiles: string[] = []
  
  try {
    const baseName = path.basename(circuitFile, path.extname(circuitFile))
    
    // Generate circuit JSON using tscircuit
    const circuitJson = await generateCircuitJson(circuitFile, workingDirectory)
    
    if (!circuitJson || (Array.isArray(circuitJson) && circuitJson.length === 0)) {
      core.warning(`⚠️ No circuit data generated for ${circuitFile}`)
      return []
    }
    
    // Generate PCB SVG
    try {
      const pcbSvg = convertCircuitJsonToPcbSvg(circuitJson)
      const pcbPath = path.join(snapshotsDir, `${baseName}-pcb.svg`)
      fs.writeFileSync(pcbPath, pcbSvg)
      svgFiles.push(pcbPath)
      core.info(`📸 Created PCB SVG: ${path.relative(process.cwd(), pcbPath)}`)
    } catch (error) {
      core.warning(`Failed to generate PCB SVG for ${circuitFile}: ${error}`)
    }
    
    // Generate Schematic SVG
    try {
      const schematicSvg = convertCircuitJsonToSchematicSvg(circuitJson)
      const schematicPath = path.join(snapshotsDir, `${baseName}-schematic.svg`)
      fs.writeFileSync(schematicPath, schematicSvg)
      svgFiles.push(schematicPath)
      core.info(`📸 Created Schematic SVG: ${path.relative(process.cwd(), schematicPath)}`)
    } catch (error) {
      core.warning(`Failed to generate Schematic SVG for ${circuitFile}: ${error}`)
    }
    
    // Generate 3D SVG
    try {
      const threeDSvg = await convertCircuitJsonToSimple3dSvg(circuitJson)
      const threeDPath = path.join(snapshotsDir, `${baseName}-3d.svg`)
      fs.writeFileSync(threeDPath, threeDSvg)
      svgFiles.push(threeDPath)
      core.info(`📸 Created 3D SVG: ${path.relative(process.cwd(), threeDPath)}`)
    } catch (error) {
      core.warning(`Failed to generate 3D SVG for ${circuitFile}: ${error}`)
    }
    
    return svgFiles
  } catch (error) {
    core.error(`❌ Failed to create SVGs for ${circuitFile}: ${error}`)
    return []
  }
}