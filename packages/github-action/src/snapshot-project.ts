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
import { saveSvgAsPng, ImageFormat } from "./svg-to-png"

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
  pngFiles: string[]
  buildTime: number
  success: boolean
  error?: string
}

interface CircuitSnapshot {
  name: string
  pcbSvg: string
  schematicSvg: string
  threeDSvg: string
  pcbPng: string
  schematicPng: string
  threeDPng: string
}

interface SvgPreview {
  name: string
  type: 'pcb' | 'schematic' | '3d'
  svgContent: string
  svgFilePath: string
  pngFilePath?: string
}

interface PngPreview {
  name: string
  type: 'pcb' | 'schematic' | '3d'
  pngFilePath: string
  svgFilePath: string
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
      
      // Look for corresponding PNG file
      const pngFile = snapshotResult.pngFiles.find(png => 
        path.basename(png) === fileName.replace('.svg', '.png')
      )
      
      previews.push({
        name: baseName,
        type,
        svgContent,
        svgFilePath: svgFile,
        pngFilePath: pngFile
      })
    } catch (error) {
      core.warning(`Failed to read SVG file ${svgFile}: ${error}`)
    }
  }
  
  return previews
}

export async function getPngPreviews(snapshotResult: SnapshotResult): Promise<PngPreview[]> {
  const previews: PngPreview[] = []
  
  for (const pngFile of snapshotResult.pngFiles) {
    try {
      const fileName = path.basename(pngFile)
      const baseName = fileName.replace(/-(pcb|schematic|3d)\.png$/, '')
      const type = fileName.includes('-pcb.png') ? 'pcb' 
                 : fileName.includes('-schematic.png') ? 'schematic'
                 : '3d'
      
      // Look for corresponding SVG file
      const svgFile = snapshotResult.svgFiles.find(svg => 
        path.basename(svg) === fileName.replace('.png', '.svg')
      )
      
      if (svgFile) {
        previews.push({
          name: baseName,
          type,
          pngFilePath: pngFile,
          svgFilePath: svgFile
        })
      }
    } catch (error) {
      core.warning(`Failed to process PNG file ${pngFile}: ${error}`)
    }
  }
  
  return previews
}

export async function snapshotProject(workingDirectory: string): Promise<SnapshotResult> {
  const startTime = Date.now()
  const result: SnapshotResult = {
    circuitFiles: [],
    svgFiles: [],
    pngFiles: [],
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

    // Generate SVG and PNG snapshots for each circuit file
    for (const circuitFile of circuitFiles) {
      try {
        const { svgFiles, pngFiles } = await generateCircuitSvgs(circuitFile, snapshotsDir, workingDirectory)
        result.svgFiles.push(...svgFiles)
        result.pngFiles.push(...pngFiles)
      } catch (error) {
        core.warning(`Failed to generate SVGs/PNGs for ${circuitFile}: ${error}`)
        // Continue with other files
      }
    }

    core.info(`✅ Generated ${result.svgFiles.length} SVG snapshot(s) and ${result.pngFiles.length} PNG snapshot(s)`)
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

async function generateCircuitSvgs(circuitFile: string, snapshotsDir: string, workingDirectory: string): Promise<{ svgFiles: string[], pngFiles: string[] }> {
  const svgFiles: string[] = []
  const pngFiles: string[] = []
  
  try {
    const baseName = path.basename(circuitFile, path.extname(circuitFile))
    
    // Generate circuit JSON using tscircuit
    const circuitJson = await generateCircuitJson(circuitFile, workingDirectory)
    
    if (!circuitJson || (Array.isArray(circuitJson) && circuitJson.length === 0)) {
      core.warning(`⚠️ No circuit data generated for ${circuitFile}`)
      return { svgFiles: [], pngFiles: [] }
    }
    
    // Generate PCB SVG and PNG
    try {
      const pcbSvg = convertCircuitJsonToPcbSvg(circuitJson)
      const pcbSvgPath = path.join(snapshotsDir, `${baseName}-pcb.svg`)
      const pcbPngPath = path.join(snapshotsDir, `${baseName}-pcb.png`)
      
      fs.writeFileSync(pcbSvgPath, pcbSvg)
      svgFiles.push(pcbSvgPath)
      core.info(`📸 Created PCB SVG: ${path.relative(process.cwd(), pcbSvgPath)}`)
      
      // Generate PNG from SVG
      await saveSvgAsPng(pcbSvgPath, pcbPngPath, { format: "pcb" })
      pngFiles.push(pcbPngPath)
    } catch (error) {
      core.warning(`Failed to generate PCB SVG/PNG for ${circuitFile}: ${error}`)
    }
    
    // Generate Schematic SVG and PNG
    try {
      const schematicSvg = convertCircuitJsonToSchematicSvg(circuitJson)
      const schematicSvgPath = path.join(snapshotsDir, `${baseName}-schematic.svg`)
      const schematicPngPath = path.join(snapshotsDir, `${baseName}-schematic.png`)
      
      fs.writeFileSync(schematicSvgPath, schematicSvg)
      svgFiles.push(schematicSvgPath)
      core.info(`📸 Created Schematic SVG: ${path.relative(process.cwd(), schematicSvgPath)}`)
      
      // Generate PNG from SVG
      await saveSvgAsPng(schematicSvgPath, schematicPngPath, { format: "schematic" })
      pngFiles.push(schematicPngPath)
    } catch (error) {
      core.warning(`Failed to generate Schematic SVG/PNG for ${circuitFile}: ${error}`)
    }
    
    // Generate 3D SVG and PNG
    try {
      const threeDSvg = await convertCircuitJsonToSimple3dSvg(circuitJson)
      const threeDSvgPath = path.join(snapshotsDir, `${baseName}-3d.svg`)
      const threeDPngPath = path.join(snapshotsDir, `${baseName}-3d.png`)
      
      fs.writeFileSync(threeDSvgPath, threeDSvg)
      svgFiles.push(threeDSvgPath)
      core.info(`📸 Created 3D SVG: ${path.relative(process.cwd(), threeDSvgPath)}`)
      
      // Generate PNG from SVG
      await saveSvgAsPng(threeDSvgPath, threeDPngPath, { format: "3d" })
      pngFiles.push(threeDPngPath)
    } catch (error) {
      core.warning(`Failed to generate 3D SVG/PNG for ${circuitFile}: ${error}`)
    }
    
    return { svgFiles, pngFiles }
  } catch (error) {
    core.error(`❌ Failed to create SVGs/PNGs for ${circuitFile}: ${error}`)
    return { svgFiles: [], pngFiles: [] }
  }
}