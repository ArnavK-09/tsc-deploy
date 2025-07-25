import { useState } from "react";
import {
  Clock,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Terminal,
  RotateCcw,
  Zap,
} from "lucide-react";

interface Job {
  id: string;
  status: string;
  priority: number;
  startedAt?: string;
  completedAt?: string;
  retryCount: number;
  errorMessage?: string;
  progress?: number;
  logs?: string;
}

interface JobListProps {
  jobs: Job[];
}

const statusConfig: Record<
  string,
  { color: string; icon: React.ReactNode; bg: string }
> = {
  queued: {
    color: "text-blue-700",
    icon: <Clock className="w-4 h-4" />,
    bg: "bg-blue-100 border-blue-300",
  },
  processing: {
    color: "text-amber-700",
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    bg: "bg-amber-100 border-amber-300",
  },
  completed: {
    color: "text-green-700",
    icon: <CheckCircle className="w-4 h-4" />,
    bg: "bg-green-100 border-green-300",
  },
  failed: {
    color: "text-red-700",
    icon: <XCircle className="w-4 h-4" />,
    bg: "bg-red-100 border-red-300",
  },
  cancelled: {
    color: "text-slate-700",
    icon: <AlertCircle className="w-4 h-4" />,
    bg: "bg-slate-100 border-slate-300",
  },
};

const JobList: React.FC<JobListProps> = ({ jobs }) => {
  const [openLogs, setOpenLogs] = useState<Record<string, boolean>>({});

  const toggleLogs = (id: string) => {
    setOpenLogs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!jobs || jobs.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 text-center shadow-sm">
        <Terminal className="w-10 h-10 sm:w-12 sm:h-12 text-slate-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-2">
          No Build Jobs
        </h3>
        <p className="text-slate-600">No jobs found for this deployment.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center space-x-3">
        <Zap className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg sm:text-xl font-semibold text-slate-900">
          Build Jobs
        </h2>
        <span className="text-sm text-slate-600">({jobs.length})</span>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {jobs.map((job) => {
          const status = statusConfig[job.status] || statusConfig.queued;
          const isLogsOpen = openLogs[job.id];

          return (
            <div
              key={job.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"
            >
              <div className="p-4 sm:p-6">
                {/* Job Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border ${status.bg} ${status.color} w-fit`}
                    >
                      {status.icon}
                      <span className="text-sm font-medium capitalize">
                        {job.status}
                      </span>
                    </div>
                    <span className="text-slate-600 font-mono text-sm">
                      #{job.id.slice(0, 8)}
                    </span>
                  </div>

                  {job.logs && (
                    <button
                      onClick={() => toggleLogs(job.id)}
                      className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm w-fit"
                    >
                      <Terminal className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {isLogsOpen ? "Hide Logs" : "Show Logs"}
                      </span>
                      <span className="sm:hidden">
                        {isLogsOpen ? "Hide" : "Logs"}
                      </span>
                      {isLogsOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Job Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
                  <div className="flex items-center space-x-2">
                    <Play className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">Priority</div>
                      <div className="text-sm font-medium">{job.priority}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">Started</div>
                      <div className="text-sm font-medium">
                        {job.startedAt
                          ? new Date(job.startedAt).toLocaleTimeString()
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">Completed</div>
                      <div className="text-sm font-medium">
                        {job.completedAt
                          ? new Date(job.completedAt).toLocaleTimeString()
                          : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <RotateCcw className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="text-xs text-slate-500">Retries</div>
                      <div className="text-sm font-medium">
                        {job.retryCount}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {typeof job.progress === "number" && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-500">Progress</span>
                      <span className="text-sm font-medium text-blue-600">
                        {job.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {job.errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 text-red-700">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Error</span>
                    </div>
                    <p className="text-sm text-red-600 mt-1">
                      {job.errorMessage}
                    </p>
                  </div>
                )}
              </div>

              {/* Logs Section */}
              {job.logs && isLogsOpen && (
                <div className="border-t border-slate-200 bg-slate-50">
                  <div className="p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <Terminal className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-blue-600">
                        Build Logs
                      </span>
                    </div>
                    <pre className="bg-slate-900 rounded-lg p-4 text-xs text-slate-100 max-h-60 overflow-auto whitespace-pre-wrap font-mono">
                      {job.logs}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default JobList;
