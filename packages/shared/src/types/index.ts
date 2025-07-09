export interface SnapshotResult {
  circuitFiles: Array<{
    path: string;
    name: string;
    svg: {
      pcb: string | null;
      schematic: string | null;
    };
  }>;
  buildTime: number;
  success: boolean;
  error?: string;
}
