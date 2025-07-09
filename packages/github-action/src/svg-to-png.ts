import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import * as core from '@actions/core';

export type ImageFormat = "schematic" | "pcb" | "assembly" | "3d";

interface ConvertSvgToPngOptions {
  width?: number;
  height?: number;
  format: ImageFormat;
}

export const convertSvgToPng = async (
  svgString: string, 
  options: ConvertSvgToPngOptions = { format: "pcb" }
): Promise<Buffer> => {
  try {
    let sharpInstance = sharp(Buffer.from(svgString));
    
    if (options.width || options.height) {
      sharpInstance = sharpInstance.resize(options.width, options.height, {
        fit: 'inside',
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      });
    }
    
    const pngBuffer = await sharpInstance
      .png({ quality: 90 })
      .toBuffer();
    
    return pngBuffer;
  } catch (error) {
    throw new Error(`Failed to convert SVG to PNG: ${error instanceof Error ? error.message : error}`);
  }
};

export const saveSvgAsPng = async (
  svgFilePath: string,
  outputPath: string,
  options: ConvertSvgToPngOptions = { format: "pcb" }
): Promise<string> => {
  try {
    const svgContent = fs.readFileSync(svgFilePath, 'utf-8');
    const pngBuffer = await convertSvgToPng(svgContent, options);
    
    fs.writeFileSync(outputPath, pngBuffer);
    core.info(`📸 Created PNG: ${path.relative(process.cwd(), outputPath)}`);
    
    return outputPath;
  } catch (error) {
    throw new Error(`Failed to save SVG as PNG: ${error instanceof Error ? error.message : error}`);
  }
};

export const createPngFromCircuitJson = async (
  circuitJson: any,
  fileName: string,
  outputDir: string,
  format: ImageFormat,
  options: ConvertSvgToPngOptions = { format }
): Promise<string> => {
  const { 
    convertCircuitJsonToPcbSvg,
    convertCircuitJsonToSchematicSvg
  } = await import("circuit-to-svg");
  
  const { convertCircuitJsonToSimple3dSvg } = await import("circuit-json-to-simple-3d");
  
  try {
    let svg: string;
    
    switch (format) {
      case "schematic":
        svg = convertCircuitJsonToSchematicSvg(circuitJson);
        break;
      case "pcb":
        svg = convertCircuitJsonToPcbSvg(circuitJson);
        break;
      case "3d":
      case "assembly":
        svg = await convertCircuitJsonToSimple3dSvg(circuitJson);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
    
    const pngBuffer = await convertSvgToPng(svg, { ...options, format });
    const outputPath = path.join(outputDir, `${fileName}-${format}.png`);
    
    fs.writeFileSync(outputPath, pngBuffer);
    core.info(`📸 Created ${format.toUpperCase()} PNG: ${path.relative(process.cwd(), outputPath)}`);
    
    return outputPath;
  } catch (error) {
    throw new Error(`Failed to create ${format} PNG: ${error instanceof Error ? error.message : error}`);
  }
}; 