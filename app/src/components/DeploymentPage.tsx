import { useEffect, useState } from "react";
import { Package, Zap, AlertCircle, Loader2, ArrowLeft } from "lucide-react";
import DeploymentDetails from "./DeploymentDetails";
import JobList from "./JobList";
import ArtifactList from "./ArtifactList";

const DeploymentPage = ({ id }: { id: string }) => {
  const [deploymentData, setDeploymentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeploymentData = async () => {
      try {
        const response = await fetch(`/api/deployment/${id}`);
        if (!response.ok) throw new Error("Failed to fetch deployment data");
        const data = await response.json();
        setDeploymentData(data);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    fetchDeploymentData();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center space-x-3 text-slate-900">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h2 className="text-xl font-semibold text-slate-900">
            Failed to load deployment
          </h2>
          <p className="text-slate-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!deploymentData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Package className="w-12 h-12 text-slate-400 mx-auto" />
          <h2 className="text-xl font-semibold text-slate-900">
            No deployment found
          </h2>
          <p className="text-slate-600">
            The deployment you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <div className="border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
              <h1 className="text-lg sm:text-xl font-semibold truncate">
                Deployment Preview
              </h1>
              <span className="text-slate-500 text-sm sm:text-base font-mono truncate">
                #{id}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <DeploymentDetails deployment={deploymentData.deployment} />
        <JobList jobs={deploymentData.deployment.buildJobs} />
        <ArtifactList
          jobs={deploymentData.deployment.buildJobs}
          deploymentId={deploymentData.deployment.id}
        />
      </div>
    </div>
  );
};

export default DeploymentPage;
