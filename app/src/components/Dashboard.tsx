import { useEffect, useState } from "react";
import {
  Loader2,
  AlertCircle,
  Eye,
  Play,
  ExternalLink,
  GitBranch,
  GitCommit,
  Clock,
  Package,
} from "lucide-react";

interface Deployment {
  id: string;
  owner: string;
  repo: string;
  status: "ready" | "pending" | "error";
  metaType: "pull_request" | "push";
  meta: string;
  commitSha: string;
  totalCircuitFiles: number;
  buildDuration?: number;
  createdAt: string;
  errorMessage?: string;
}

interface DeploymentsResponse {
  deployments: Deployment[];
  pagination: {
    totalCount: number;
  };
}

const Dashboard = () => {
  const [deploymentsData, setDeploymentsData] =
    useState<DeploymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeployments = async () => {
      try {
        const response = await fetch("/api/deployments?limit=50");
        if (response.ok) {
          const data = await response.json();
          setDeploymentsData(data);
        } else {
          setError(`Failed to fetch deployments: ${response.status}`);
        }
      } catch (e) {
        console.error(e);
        setError(
          `Error fetching deployments: ${e instanceof Error ? e.message : "Unknown error"}`,
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDeployments();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-900">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-lg font-medium">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <img
            src="https://github.com/tscircuit.png"
            alt="TSCircuit"
            className="w-8 h-8 rounded-lg"
          />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600">Monitor your circuit deployments</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-8">
          <div className="flex items-center space-x-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Error:</span>
          </div>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      )}

      {deploymentsData && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="text-2xl font-bold text-slate-900 mb-1">
                {deploymentsData.pagination?.totalCount || 0}
              </div>
              <div className="text-sm text-slate-600">Total Deployments</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {deploymentsData.deployments?.filter(
                  (d) => d.status === "ready",
                ).length || 0}
              </div>
              <div className="text-sm text-slate-600">Successful</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="text-2xl font-bold text-amber-600 mb-1">
                {deploymentsData.deployments?.filter(
                  (d) => d.status === "pending",
                ).length || 0}
              </div>
              <div className="text-sm text-slate-600">In Progress</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="text-2xl font-bold text-red-600 mb-1">
                {deploymentsData.deployments?.filter(
                  (d) => d.status === "error",
                ).length || 0}
              </div>
              <div className="text-sm text-slate-600">Failed</div>
            </div>
          </div>

          {/* Deployments List */}
          <div className="space-y-6">
            <div className="flex items-center space-x-3">
              <Package className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-semibold text-slate-900">
                Recent Deployments
              </h2>
            </div>

            <div className="space-y-4">
              {deploymentsData.deployments?.length > 0 ? (
                deploymentsData.deployments.map((deployment) => {
                  const statusConfig = {
                    ready: {
                      color: "text-green-700",
                      bg: "bg-green-100 border-green-300",
                    },
                    pending: {
                      color: "text-amber-700",
                      bg: "bg-amber-100 border-amber-300",
                    },
                    error: {
                      color: "text-red-700",
                      bg: "bg-red-100 border-red-300",
                    },
                  };
                  const status =
                    statusConfig[
                      deployment.status as keyof typeof statusConfig
                    ] || statusConfig.pending;

                  return (
                    <div
                      key={deployment.id}
                      className="bg-white border border-slate-200 rounded-xl p-6 hover:border-slate-300 transition-colors shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-slate-900 mb-1">
                            {deployment.owner}/{deployment.repo}
                          </h3>
                          <div className="flex items-center space-x-2 text-sm text-slate-600">
                            <span>
                              {deployment.metaType === "pull_request"
                                ? `PR #${deployment.meta}`
                                : `Push to ${deployment.meta}`}
                            </span>
                            <span>•</span>
                            <span className="font-mono">
                              {deployment.commitSha.substring(0, 7)}
                            </span>
                          </div>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-lg border text-sm font-medium ${status.bg} ${status.color}`}
                        >
                          {deployment.status}
                        </div>
                      </div>

                      {/* Deployment Details Grid */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="flex items-center space-x-2">
                          <Package className="w-4 h-4 text-slate-500" />
                          <div>
                            <div className="text-xs text-slate-500">
                              Circuits
                            </div>
                            <div className="text-sm font-medium text-slate-900">
                              {deployment.totalCircuitFiles}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <div>
                            <div className="text-xs text-slate-500">
                              Build Time
                            </div>
                            <div className="text-sm font-medium text-slate-900">
                              {deployment.buildDuration
                                ? `${deployment.buildDuration}s`
                                : "N/A"}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <GitCommit className="w-4 h-4 text-slate-500" />
                          <div>
                            <div className="text-xs text-slate-500">Commit</div>
                            <div className="text-sm font-medium text-slate-900 font-mono">
                              {deployment.commitSha.substring(0, 7)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-slate-500" />
                          <div>
                            <div className="text-xs text-slate-500">
                              Created
                            </div>
                            <div className="text-sm font-medium text-slate-900">
                              {new Date(
                                deployment.createdAt,
                              ).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {deployment.errorMessage && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                          <div className="flex items-center space-x-2 text-red-700">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-sm font-medium">Error</span>
                          </div>
                          <p className="text-sm text-red-600 mt-1">
                            {deployment.errorMessage}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-3">
                        <a
                          href={`/deployment/${deployment.id}`}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View Details</span>
                        </a>
                        {deployment.status === "ready" && (
                          <a
                            href={`/deployment/${deployment.id}?preview`}
                            className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
                          >
                            <Play className="w-4 h-4" />
                            <span>Preview</span>
                          </a>
                        )}
                        <a
                          href={`https://github.com/${deployment.owner}/${deployment.repo}`}
                          className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition-colors"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View repository on GitHub"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Repository</span>
                        </a>
                        <a
                          href={`https://github.com/${deployment.owner}/${deployment.repo}/commit/${deployment.commitSha}`}
                          className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition-colors"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View commit on GitHub"
                        >
                          <GitCommit className="w-4 h-4" />
                          <span>Commit</span>
                        </a>
                        {deployment.metaType === "pull_request" && (
                          <a
                            href={`https://github.com/${deployment.owner}/${deployment.repo}/pull/${deployment.meta}`}
                            className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg transition-colors"
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View pull request on GitHub"
                          >
                            <GitBranch className="w-4 h-4" />
                            <span>Pull Request</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-12 text-center">
                  <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    No deployments found
                  </h3>
                  <p className="text-slate-600">
                    Deployments will appear here once you start using tscircuit
                    deploy.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
