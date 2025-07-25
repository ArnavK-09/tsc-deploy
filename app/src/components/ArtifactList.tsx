import { useState } from "react";
import {
  Package,
  File,
  Download,
  Eye,
  Calendar,
  HardDrive,
  Folder,
  FileText,
  Zap,
} from "lucide-react";
import ArtifactCircuitJsonModal from "./ArtifactCircuitJsonModal";

interface Artifact {
  id: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  createdAt: string;
}

interface Job {
  buildArtifacts: Artifact[];
}

interface ArtifactListProps {
  jobs: Job[];
  deploymentId: string;
}

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return "—";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const getFileIcon = (fileName: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "json":
      return <FileText className="w-5 h-5 text-cyan-600" />;
    case "svg":
    case "png":
    case "jpg":
    case "jpeg":
      return <File className="w-5 h-5 text-purple-600" />;
    default:
      return <File className="w-5 h-5 text-slate-500" />;
  }
};

const ArtifactList: React.FC<ArtifactListProps> = ({ jobs }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalFileName, setModalFileName] = useState("");
  const [modalCircuitJson, setModalCircuitJson] = useState<
    object | string | null
  >(null);
  const [loading, setLoading] = useState(false);

  const allArtifacts = Array.isArray(jobs)
    ? jobs.flatMap((job) => job.buildArtifacts || [])
    : [];

  const handleViewCircuitJson = async (artifact: Artifact) => {
    setModalOpen(true);
    setModalFileName(artifact.fileName);
    setLoading(true);
    setModalCircuitJson(null);
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}/download`);
      if (!res.ok) throw new Error("Failed to fetch circuit JSON");
      const json = (await res.json()) as object;
      setModalCircuitJson(json);
    } catch (err) {
      setModalCircuitJson("Error loading circuit JSON");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (artifact: Artifact) => {
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}/download`);
      if (!res.ok) throw new Error("Failed to download artifact");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = artifact.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center space-x-3">
        <Package className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
          Build Artifacts
        </h2>
        <span className="text-sm text-slate-600">({allArtifacts.length})</span>
      </div>

      {allArtifacts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 lg:p-12 text-center shadow-sm">
          <Package className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            No Artifacts
          </h3>
          <p className="text-slate-600 text-sm sm:text-base">
            No build artifacts found for this deployment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {allArtifacts.map((artifact) => (
            <div
              key={artifact.id}
              className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm hover:border-slate-300 transition-colors"
            >
              {/* File Header */}
              <div className="flex items-start space-x-3 mb-4 min-w-0">
                <div className="flex-shrink-0">
                  {getFileIcon(artifact.fileName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-900 truncate">
                    {artifact.fileName}
                  </h3>
                  <div className="flex items-center space-x-1 text-xs text-slate-600 mt-1 min-w-0">
                    <Folder className="w-3 h-3 flex-shrink-0" />
                    <span className="truncate">{artifact.filePath}</span>
                  </div>
                </div>
              </div>

              {/* File Details */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-slate-600">
                    <HardDrive className="w-4 h-4" />
                    <span>Size</span>
                  </div>
                  <span className="text-sm font-medium text-slate-900">
                    {formatFileSize(artifact.fileSize)}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-slate-600">
                    <Calendar className="w-4 h-4" />
                    <span>Created</span>
                  </div>
                  <span className="text-sm font-medium text-slate-900">
                    {new Date(artifact.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleViewCircuitJson(artifact)}
                  className="flex items-center justify-center space-x-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 rounded-lg transition-colors text-blue-700 text-sm font-medium w-full"
                >
                  <Zap className="w-4 h-4" />
                  <span>Preview</span>
                </button>

                <button
                  onClick={() => handleDownload(artifact)}
                  className="flex items-center justify-center space-x-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 hover:border-slate-400 rounded-lg transition-colors text-slate-700 text-sm font-medium w-full"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ArtifactCircuitJsonModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        circuitJson={loading ? "Loading..." : modalCircuitJson}
        fileName={modalFileName}
      />
    </div>
  );
};

export default ArtifactList;
