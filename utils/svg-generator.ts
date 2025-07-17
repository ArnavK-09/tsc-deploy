import {
  convertCircuitJsonToPcbSvg,
  convertCircuitJsonToSchematicSvg,
} from "circuit-to-svg";
import { convertCircuitJsonToSimple3dSvg } from "circuit-json-to-simple-3d";

export type SvgType = "pcb" | "schematic" | "3d";

export interface SvgGenerationOptions {
  type: SvgType;
  width?: number;
  height?: number;
  theme?: "light" | "dark";
}

export class SvgGenerator {
  static async generateSvg(
    circuitJson: any,
    options: SvgGenerationOptions,
  ): Promise<string> {
    if (
      !circuitJson ||
      (Array.isArray(circuitJson) && circuitJson.length === 0)
    ) {
      throw new Error("No circuit data provided");
    }

    try {
      let svgContent: string;

      switch (options.type) {
        case "pcb":
          svgContent = convertCircuitJsonToPcbSvg(circuitJson);
          break;
        case "schematic":
          svgContent = convertCircuitJsonToSchematicSvg(circuitJson);
          break;
        case "3d":
          svgContent = await convertCircuitJsonToSimple3dSvg(circuitJson);
          break;
        default:
          throw new Error(`Unsupported SVG type: ${options.type}`);
      }

      // Apply custom dimensions if provided
      if (options.width || options.height) {
        svgContent = this.applySvgDimensions(
          svgContent,
          options.width,
          options.height,
        );
      }

      // Apply theme if provided
      if (options.theme) {
        svgContent = this.applySvgTheme(svgContent, options.theme);
      }

      return svgContent;
    } catch (error) {
      throw new Error(`Failed to generate ${options.type} SVG: ${error}`);
    }
  }

  static async generateAllSvgs(circuitJson: any): Promise<{
    pcb: string | null;
    schematic: string | null;
    pcb3d: string | null;
  }> {
    const results = {
      pcb: null as string | null,
      schematic: null as string | null,
      pcb3d: null as string | null,
    };

    try {
      results.pcb = await this.generateSvg(circuitJson, { type: "pcb" });
    } catch (error) {
      console.warn("Failed to generate PCB SVG:", error);
    }

    try {
      results.schematic = await this.generateSvg(circuitJson, {
        type: "schematic",
      });
    } catch (error) {
      console.warn("Failed to generate schematic SVG:", error);
    }

    try {
      results.pcb3d = await this.generateSvg(circuitJson, { type: "3d" });
    } catch (error) {
      console.warn("Failed to generate 3D SVG:", error);
    }

    return results;
  }

  private static applySvgDimensions(
    svgContent: string,
    width?: number,
    height?: number,
  ): string {
    if (!width && !height) return svgContent;

    // Extract viewBox if exists
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
    let svgTag = svgContent.match(/<svg[^>]*>/)?.[0] || "<svg>";

    if (width) {
      svgTag = svgTag.replace(/width="[^"]*"/, `width="${width}"`);
      if (!svgTag.includes("width=")) {
        svgTag = svgTag.replace("<svg", `<svg width="${width}"`);
      }
    }

    if (height) {
      svgTag = svgTag.replace(/height="[^"]*"/, `height="${height}"`);
      if (!svgTag.includes("height=")) {
        svgTag = svgTag.replace("<svg", `<svg height="${height}"`);
      }
    }

    return svgContent.replace(/<svg[^>]*>/, svgTag);
  }

  private static applySvgTheme(
    svgContent: string,
    theme: "light" | "dark",
  ): string {
    if (theme === "dark") {
      // Apply dark theme transformations
      svgContent = svgContent.replace(/fill="white"/g, 'fill="#1a1a1a"');
      svgContent = svgContent.replace(/stroke="black"/g, 'stroke="white"');
      svgContent = svgContent.replace(/fill="black"/g, 'fill="white"');
    }

    return svgContent;
  }

  static async generatePreviewSvg(
    circuitJson: any,
    type: SvgType = "pcb",
    maxWidth: number = 400,
    maxHeight: number = 300,
  ): Promise<string> {
    return this.generateSvg(circuitJson, {
      type,
      width: maxWidth,
      height: maxHeight,
    });
  }

  static validateCircuitJson(circuitJson: any): boolean {
    if (!circuitJson) return false;
    if (Array.isArray(circuitJson) && circuitJson.length === 0) return false;

    if (Array.isArray(circuitJson)) {
      return circuitJson.some(
        (item) =>
          item &&
          typeof item === "object" &&
          (item.type || item.ftype || item.component_id),
      );
    }

    return typeof circuitJson === "object" && circuitJson !== null;
  }

  static getEstimatedSvgSize(circuitJson: any): {
    estimatedBytes: number;
    complexity: "low" | "medium" | "high";
  } {
    const jsonSize = JSON.stringify(circuitJson).length;
    const elementCount = Array.isArray(circuitJson) ? circuitJson.length : 1;

    // Rough estimation based on circuit complexity
    const estimatedBytes = Math.max(jsonSize * 2, elementCount * 1000);

    let complexity: "low" | "medium" | "high" = "low";
    if (elementCount > 100 || jsonSize > 50000) {
      complexity = "high";
    } else if (elementCount > 20 || jsonSize > 10000) {
      complexity = "medium";
    }

    return { estimatedBytes, complexity };
  }
}
