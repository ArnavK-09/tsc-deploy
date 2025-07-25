import {
  GitCommit,
  Clock,
  Package,
  User,
  Calendar,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  Github,
  GitBranch,
  Globe,
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
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
      {/* Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${statusInfo.bg} ${statusInfo.color} w-fit`}
          >
            {statusInfo.icon}
            <span className="text-sm font-medium capitalize">{status}</span>
          </div>
          <div className="text-slate-500 text-sm">
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
      <div className="bg-white rounded-lg border border-slate-200 p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">
          Repository
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Github className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-500">Repository</div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-slate-900 break-all">
                    {deployment.owner}/{deployment.repo}
                  </span>
                  <a
                    href={`https://github.com/${deployment.owner}/${deployment.repo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 transition-colors flex-shrink-0"
                    title="View repository on GitHub"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <GitCommit className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-500">Commit</div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-blue-600 break-all">
                    {deployment.commitSha
                      ? deployment.commitSha.slice(0, 8)
                      : "—"}
                  </span>
                  {deployment.commitSha && (
                    <a
                      href={`https://github.com/${deployment.owner}/${deployment.repo}/commit/${deployment.commitSha}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 transition-colors flex-shrink-0"
                      title="View commit on GitHub"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <Package className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm text-slate-500">Circuit Files</div>
                <div className="font-medium text-slate-900">
                  {deployment.totalCircuitFiles ?? 0}
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <GitBranch className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-500">
                  {deployment.metaType === "pull_request"
                    ? "Pull Request"
                    : "Branch"}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-slate-900 break-all">
                    {deployment.metaType === "pull_request"
                      ? `#${deployment.meta}`
                      : deployment.meta}
                  </span>
                  {deployment.metaType === "pull_request" && (
                    <a
                      href={`https://github.com/${deployment.owner}/${deployment.repo}/pull/${deployment.meta}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 transition-colors flex-shrink-0"
                      title="View pull request on GitHub"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {deployment.metaType === "push" && (
                    <a
                      href={`https://github.com/${deployment.owner}/${deployment.repo}/tree/${deployment.meta}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 transition-colors flex-shrink-0"
                      title="View branch on GitHub"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
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
