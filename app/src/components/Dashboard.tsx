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
  Activity,
  Database,
  Server,
  Cpu,
  CheckCircle,
  XCircle,
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

interface HealthData {
  status: "healthy" | "unhealthy";
  timestamp: string;
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  database: {
    connected: boolean;
    error?: string;
  };
  environment: {
    nodeEnv: string;
    hasDatabaseUrl: boolean;
    databaseUrlHost: string;
  };
}

const Dashboard = () => {
  const [deploymentsData, setDeploymentsData] =
    useState<DeploymentsResponse | null>(null);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeployments = async () => {
      try {
        const response = await fetch("/api/deployments?limit=50");
        if (response.ok) {
          const data = (await response.json()) as DeploymentsResponse;
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

    const fetchHealth = async () => {
      try {
        const response = await fetch("/api");
        if (response.ok) {
          const data = (await response.json()) as HealthData;
          setHealthData(data);
        } else {
          setHealthError(`Failed to fetch health data: ${response.status}`);
        }
      } catch (e) {
        console.error(e);
        setHealthError(
          `Error fetching health data: ${e instanceof Error ? e.message : "Unknown error"}`,
        );
      } finally {
        setHealthLoading(false);
      }
    };

    fetchDeployments();
    fetchHealth();

    // Refresh health data every 30 seconds
    const healthInterval = setInterval(fetchHealth, 30000);
    return () => clearInterval(healthInterval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-900">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3 min-w-0">
          <img
            src="https://github.com/tscircuit.png"
            alt="TSCircuit"
            className="w-8 h-8 rounded-lg flex-shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 truncate">
              Dashboard
            </h1>
            <p className="text-slate-600 text-sm sm:text-base">
              Monitor your circuit deployments
            </p>
          </div>
        </div>
      </div>

      {/* System Health Status */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-4 sm:mb-6">
          <Activity className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
            System Health
          </h2>
        </div>

        {healthLoading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              <span className="text-slate-600">Loading health status...</span>
            </div>
          </div>
        ) : healthError ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">Health Check Error:</span>
            </div>
            <p className="text-red-600 mt-1">{healthError}</p>
          </div>
        ) : healthData ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {/* Overall Status */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-center">
              <div className="flex items-center space-x-3 mb-2">
                {healthData.status === "healthy" ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
                <div>
                  <div
                    className={`text-lg font-bold ${
                      healthData.status === "healthy"
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {healthData.status === "healthy" ? "Healthy" : "Unhealthy"}
                  </div>
                  <div className="text-sm text-slate-600">System Status</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Health</span>
                  <span>{healthData.status === "healthy" ? "100%" : "0%"}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      healthData.status === "healthy"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                    style={{
                      width: healthData.status === "healthy" ? "100%" : "0%",
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Database Status */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-center">
              <div className="flex items-center space-x-3 mb-2">
                <Database
                  className={`w-6 h-6 ${
                    healthData.database.connected
                      ? "text-blue-600"
                      : "text-red-600"
                  }`}
                />
                <div>
                  <div
                    className={`text-lg font-bold ${
                      healthData.database.connected
                        ? "text-blue-700"
                        : "text-red-700"
                    }`}
                  >
                    {healthData.database.connected
                      ? "Connected"
                      : "Disconnected"}
                  </div>
                  <div className="text-sm text-slate-600">Database</div>
                </div>
              </div>
              {healthData.database.error && (
                <div className="text-xs text-red-600 mt-2 font-mono">
                  {healthData.database.error}
                </div>
              )}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Connection</span>
                  <span>{healthData.database.connected ? "100%" : "0%"}</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      healthData.database.connected
                        ? "bg-blue-500"
                        : "bg-red-500"
                    }`}
                    style={{
                      width: healthData.database.connected ? "100%" : "0%",
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Uptime */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-center">
              <div className="flex items-center space-x-3 mb-2">
                <Server className="w-6 h-6 text-purple-600" />
                <div>
                  <div className="text-lg font-bold text-slate-900">
                    {Math.floor(healthData.uptime / 3600)}h{" "}
                    {Math.floor((healthData.uptime % 3600) / 60)}m
                  </div>
                  <div className="text-sm text-slate-600">Uptime</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Stability</span>
                  <span>98%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: "98%" }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col justify-center">
              <div className="flex items-center space-x-3 mb-2">
                <Cpu className="w-6 h-6 text-orange-600" />
                <div>
                  <div className="text-lg font-bold text-slate-900">
                    {Math.round(healthData.memory.heapUsed / 1024 / 1024)}MB
                  </div>
                  <div className="text-sm text-slate-600">Memory Used</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Heap</span>
                  <span>
                    {Math.round(
                      (healthData.memory.heapUsed /
                        healthData.memory.heapTotal) *
                        100,
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.round((healthData.memory.heapUsed / healthData.memory.heapTotal) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
                {deploymentsData.pagination?.totalCount || 0}
              </div>
              <div className="text-sm text-slate-600">Total Deployments</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="text-xl sm:text-2xl font-bold text-green-600 mb-1">
                {deploymentsData.deployments?.filter(
                  (d) => d.status === "ready",
                ).length || 0}
              </div>
              <div className="text-sm text-slate-600">Successful</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="text-xl sm:text-2xl font-bold text-amber-600 mb-1">
                {deploymentsData.deployments?.filter(
                  (d) => d.status === "pending",
                ).length || 0}
              </div>
              <div className="text-sm text-slate-600">In Progress</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="text-xl sm:text-2xl font-bold text-red-600 mb-1">
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
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
                Recent Deployments
              </h2>
            </div>

            <div className="space-y-3 sm:space-y-4">
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
                      className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 hover:border-slate-300 transition-colors shadow-sm"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-slate-900 mb-1 truncate">
                            {deployment.owner}/{deployment.repo}
                          </h3>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm text-slate-600">
                            <span className="truncate">
                              {deployment.metaType === "pull_request"
                                ? `PR #${deployment.meta}`
                                : `Push to ${deployment.meta}`}
                            </span>
                            <span className="hidden sm:inline">•</span>
                            <span className="font-mono">
                              {deployment.commitSha.substring(0, 7)}
                            </span>
                          </div>
                        </div>
                        <div
                          className={`px-3 py-1 rounded-lg border text-sm font-medium w-fit ${status.bg} ${status.color}`}
                        >
                          {deployment.status}
                        </div>
                      </div>

                      {/* Deployment Details Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
                        <div className="flex items-center space-x-2 min-w-0">
                          <Package className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500">
                              Circuits
                            </div>
                            <div className="text-sm font-medium text-slate-900">
                              {deployment.totalCircuitFiles}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 min-w-0">
                          <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          <div className="min-w-0">
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
                        <div className="flex items-center space-x-2 min-w-0">
                          <GitCommit className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs text-slate-500">Commit</div>
                            <div className="text-sm font-medium text-slate-900 font-mono truncate">
                              {deployment.commitSha.substring(0, 7)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 min-w-0">
                          <Clock className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          <div className="min-w-0">
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
                          <p className="text-sm text-red-600 mt-1 break-words">
                            {deployment.errorMessage}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
                        <a
                          href={`/deployment/${deployment.id}`}
                          className="flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200 text-sm shadow-sm hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98]"
                        >
                          <Eye className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">Details</span>
                        </a>
                        {deployment.status === "ready" && (
                          <a
                            href={`/deployment/${deployment.id}?preview`}
                            className="flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-all duration-200 text-sm shadow-sm hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <Play className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">Preview</span>
                          </a>
                        )}
                        <a
                          href={`https://github.com/${deployment.owner}/${deployment.repo}`}
                          className="flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg transition-all duration-200 text-sm shadow-sm hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98]"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View repository on GitHub"
                        >
                          <ExternalLink className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate hidden sm:inline">
                            Repository
                          </span>
                          <span className="truncate sm:hidden">Repo</span>
                        </a>
                        <a
                          href={`https://github.com/${deployment.owner}/${deployment.repo}/commit/${deployment.commitSha}`}
                          className="flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg transition-all duration-200 text-sm shadow-sm hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98]"
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View commit on GitHub"
                        >
                          <GitCommit className="w-4 h-4 flex-shrink-0" />
                          <span className="truncate">Commit</span>
                        </a>
                        {deployment.metaType === "pull_request" && (
                          <a
                            href={`https://github.com/${deployment.owner}/${deployment.repo}/pull/${deployment.meta}`}
                            className="flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-300 rounded-lg transition-all duration-200 text-sm shadow-sm hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98]"
                            target="_blank"
                            rel="noopener noreferrer"
                            title="View pull request on GitHub"
                          >
                            <GitBranch className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate hidden sm:inline">
                              Pull Request
                            </span>
                            <span className="truncate sm:hidden">PR</span>
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 sm:p-12 text-center">
                  <Package className="w-12 h-12 sm:w-16 sm:h-16 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">
                    No deployments found
                  </h3>
                  <p className="text-slate-600 text-sm sm:text-base">
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
