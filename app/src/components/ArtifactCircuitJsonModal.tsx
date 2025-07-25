import { X, Copy, FileText, Check } from "lucide-react";
import { useState, useEffect } from "react";

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Circuit Preview
              </h3>
              <p className="text-sm text-slate-600">{fileName}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                copied
                  ? "bg-green-50 border border-green-200 text-green-700"
                  : "bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 text-blue-700"
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 hover:text-slate-900"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {circuitJson && typeof circuitJson === "object" ? (
            <h1>
              TODO
              {/* 
       <CircuitJsonPreview 
              circuitJson={circuitJson as any}
              showCodeTab={false}
              showJsonTab={true}
              className="h-full"
              headerClassName="px-4"
            /> */}
            </h1>
          ) : circuitJson && typeof circuitJson === "string" ? (
            <pre className="bg-slate-50 text-slate-800 text-sm p-6 h-full overflow-auto font-mono leading-relaxed">
              {circuitJson}
            </pre>
          ) : (
            <div className="text-center text-slate-500 py-8">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No circuit JSON found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ArtifactCircuitJsonModal;
