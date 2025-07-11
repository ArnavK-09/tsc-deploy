import sharp from "sharp";

export type ImageFormat = "schematic" | "pcb" | "assembly" | "3d";
import { convertCircuitJsonToPcbSvg, convertCircuitJsonToSchematicSvg } from "circuit-to-svg";
import { convertCircuitJsonToSimple3dSvg } from "circuit-json-to-simple-3d";


interface ConvertSvgToPngOptions {
  width?: number;
  height?: number;
  format: ImageFormat;
}

export const convertSvgToPng = async (
  svgString: string,
  options: ConvertSvgToPngOptions = { format: "pcb" },
): Promise<Buffer> => {
  try {
    let sharpInstance = sharp(Buffer.from(svgString));

    if (options.width || options.height) {
      sharpInstance = sharpInstance.resize(options.width, options.height, {
        fit: "inside",
        withoutEnlargement: true,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      });
    }

    const pngBuffer = await sharpInstance.png({ quality: 90 }).toBuffer();

    return pngBuffer;
  } catch (error) {
    throw new Error(
      `Failed to convert SVG to PNG: ${error instanceof Error ? error.message : error}`,
    );
  }
};


export const createPngFromCircuitJson = async (
  circuitJson: any,
  format: ImageFormat,
  options: ConvertSvgToPngOptions = { format },
): Promise<Buffer> => {
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
    return pngBuffer;
  } catch (error) {
    throw new Error(
      `Failed to create ${format} PNG: ${error instanceof Error ? error.message : error}`,
    );
  }
};
