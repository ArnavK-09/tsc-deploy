import { X, Copy, FileText, Check } from "lucide-react";
import { useState, useEffect } from "react";
import { CircuitJsonPreview } from "@tscircuit/runframe/preview";

interface ArtifactCircuitJsonModalProps {
  open: boolean;
  onClose: () => void;
  circuitJson: object | string | null;
  fileName: string;
}

const ArtifactCircuitJsonModal: React.FC<ArtifactCircuitJsonModalProps> = ({
  open,
  onClose,
  circuitJson,
  fileName,
}) => {
  const [copied, setCopied] = useState(false);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        onClose();
      }
    };

    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    if (circuitJson) {
      try {
        await navigator.clipboard.writeText(
          typeof circuitJson === "string"
            ? circuitJson
            : JSON.stringify(circuitJson, null, 2),
        );
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4 lg:p-6"
      onClick={handleBackdropClick}
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-sm sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-7xl max-h-[95vh] sm:max-h-[90vh] lg:max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-blue-600" />
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">Circuit Preview</h3>
              <p className="text-sm text-slate-500 truncate">{fileName}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className={`p-2 rounded-lg  transition-colors text-slate-400 hover:text-slate-600 hover:bg-slate-50 `}
              title={copied ? "Copied!" : "Copy JSON"}
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden min-h-0">
          {circuitJson && typeof circuitJson === "object" ? (
            <CircuitJsonPreview
              circuitJson={circuitJson as any}
              showCodeTab={false}
              showJsonTab={true}
              className="h-full w-full"
              defaultToFullScreen
              headerClassName="px-2 sm:px-4"
            />
          ) : circuitJson && typeof circuitJson === "string" ? (
            <pre className="bg-slate-50 text-slate-800 text-xs sm:text-sm lg:text-base p-2 sm:p-4 lg:p-6 h-full overflow-auto font-mono leading-relaxed whitespace-pre-wrap break-words">
              {circuitJson}
            </pre>
          ) : (
            <div className="text-center text-slate-500 py-6 sm:py-8 lg:py-12 px-4">
              <FileText className="w-10 h-10 sm:w-12 sm:h-12 lg:w-16 lg:h-16 mx-auto mb-4 opacity-50" />
              <p className="text-sm sm:text-base lg:text-lg">
                No circuit JSON found.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArtifactCircuitJsonModal;
