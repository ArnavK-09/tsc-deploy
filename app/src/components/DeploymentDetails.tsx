import {
  GitCommit,
  Clock,
  Package,
  Calendar,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Github,
  GitBranch,
} from "lucide-react";

interface DeploymentDetailsProps {
  deployment: {
    id: string;
    owner: string;
    repo: string;
    commitSha: string;
    status?: string;
    meta: string;
    metaType: string;
    buildCompletedAt?: string;
    buildDuration?: number;
    totalCircuitFiles?: number;
    createdAt: string;
  };
}

const statusConfig: Record<
  string,
  { color: string; icon: React.ReactNode; bg: string }
> = {
  ready: {
    color: "text-green-700",
    icon: <CheckCircle className="w-4 h-4" />,
    bg: "bg-green-100 border-green-300",
  },
  error: {
    color: "text-red-700",
    icon: <XCircle className="w-4 h-4" />,
    bg: "bg-red-100 border-red-300",
  },
  pending: {
    color: "text-amber-700",
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    bg: "bg-amber-100 border-amber-300",
  },
  skipped: {
    color: "text-slate-700",
    icon: <AlertCircle className="w-4 h-4" />,
    bg: "bg-slate-100 border-slate-300",
  },
};

const DeploymentDetails: React.FC<DeploymentDetailsProps> = ({
  deployment,
}) => {
  const status = deployment.status || "pending";
  const statusInfo = statusConfig[status] || statusConfig.pending;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 lg:p-8 shadow-sm space-y-4 sm:space-y-6">
      {/* Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 min-w-0">
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${statusInfo.bg} ${statusInfo.color} w-fit flex-shrink-0`}
          >
            {statusInfo.icon}
            <span className="text-sm font-medium capitalize">{status}</span>
          </div>
          <div className="text-slate-500 text-sm truncate">
            {deployment.buildCompletedAt
              ? `Completed ${new Date(deployment.buildCompletedAt).toLocaleString()}`
              : `Created ${new Date(deployment.createdAt).toLocaleString()}`}
          </div>
        </div>
        {deployment.buildDuration && (
          <div className="flex items-center space-x-2 text-blue-600">
            <Clock className="w-4 h-4" />
            <span className="text-sm font-medium">
              {deployment.buildDuration}s
            </span>
          </div>
        )}
      </div>

      {/* Repository Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-900 flex items-center space-x-2">
            <Github className="w-4 h-4" />
            <span>Repository</span>
          </h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-sm text-slate-600 flex-shrink-0">
                Owner:
              </span>
              <span className="text-sm font-medium text-slate-900 truncate">
                {deployment.owner}
              </span>
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-sm text-slate-600 flex-shrink-0">
                Repository:
              </span>
              <span className="text-sm font-medium text-slate-900 truncate">
                {deployment.repo}
              </span>
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-sm text-slate-600 flex-shrink-0">
                Commit:
              </span>
              <span className="text-sm font-mono text-slate-900 truncate">
                {deployment.commitSha.substring(0, 7)}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-900 flex items-center space-x-2">
            <Package className="w-4 h-4" />
            <span>Circuit Files</span>
          </h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-600">Total Files:</span>
              <span className="text-sm font-medium text-slate-900">
                {deployment.totalCircuitFiles || 0}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3 sm:col-span-2 lg:col-span-1">
          <h3 className="text-sm font-medium text-slate-900 flex items-center space-x-2">
            <GitBranch className="w-4 h-4" />
            <span>Branch/PR</span>
          </h3>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-sm text-slate-600 flex-shrink-0">
                Type:
              </span>
              <span className="text-sm font-medium text-slate-900 capitalize truncate">
                {deployment.metaType?.replace("_", " ") || "Unknown"}
              </span>
            </div>
            <div className="flex items-center space-x-2 min-w-0">
              <span className="text-sm text-slate-600 flex-shrink-0">
                {deployment.metaType === "pull_request" ? "PR #" : "Branch:"}:
              </span>
              <span className="text-sm font-medium text-slate-900 truncate">
                {deployment.meta || "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Deployment Details */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6 mt-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Deployment Details
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3">
            <Calendar className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm text-slate-500">Created</div>
              <div className="font-medium text-slate-900 break-words">
                {new Date(deployment.createdAt).toLocaleString()}
              </div>
            </div>
          </div>

          {deployment.buildCompletedAt && (
            <div className="flex items-start space-x-3">
              <Clock className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm text-slate-500">Completed</div>
                <div className="font-medium text-slate-900 break-words">
                  {new Date(deployment.buildCompletedAt).toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Meta Information */}
      {deployment.meta && (
        <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6 mt-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            Meta Information
          </h3>
          <div className="bg-slate-50 rounded-lg p-3 font-mono text-sm text-slate-700 break-all overflow-wrap-anywhere">
            {deployment.meta}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentDetails;
