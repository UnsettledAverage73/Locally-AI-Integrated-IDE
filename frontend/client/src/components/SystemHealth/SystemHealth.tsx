import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Zap, AlertTriangle, BarChart, Server, Database } from "lucide-react";
import { apiClient, llm } from "@/api/client"; 
import SystemResources from "../SystemResources";
import { useSettings } from "@/context/SettingsContext";
import { Badge } from "@/components/ui/badge";

interface OpsStats {
  avg_latency: number;
  total_requests: number;
  error_rate: number;
  estimated_cost_saved: number;
}

interface ModelDetails {
    name: string;
    size: number;
    details: {
        family: string;
        parameter_size: string;
    }
}

const StatCard = ({ title, value, icon, unit = "" }) => (
  <Card className="bg-card/50">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">
        {value}
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>
    </CardContent>
  </Card>
);

const EnterpriseResources = () => {
    const [models, setModels] = useState<ModelDetails[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchModelDetails = async () => {
            setLoading(true);
            try {
                const modelList = await llm.models();
                const modelDetailsPromises = modelList.models.map(async (modelName) => {
                    const info = await llm.showModelInfo(modelName);
                    return {
                        name: info.model_name,
                        size: info.size,
                        details: info.details,
                    };
                });
                const detailedModels = await Promise.all(modelDetailsPromises);
                setModels(detailedModels);
            } catch (e) {
                console.error("Failed to fetch enterprise model details", e);
            } finally {
                setLoading(false);
            }
        };
        fetchModelDetails();
    }, []);

    const formatBytes = (bytes: number, decimals = 2) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    if (loading) {
        return <p className="text-muted-foreground text-sm">Loading remote models...</p>
    }

    return (
        <div className="space-y-3">
            {models.map(model => (
                <Card key={model.name} className="bg-card/50 p-3">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold flex items-center gap-2"><Database className="w-4 h-4" /> {model.name}</p>
                            <div className="flex gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline">{model.details?.family || 'unknown'}</Badge>
                                <Badge variant="outline">{model.details?.parameter_size || 'N/A'}</Badge>
                            </div>
                        </div>
                        <p className="text-sm font-mono">{formatBytes(model.size)}</p>
                    </div>
                </Card>
            ))}
        </div>
    )
}

export default function SystemHealth() {
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { aiMode } = useSettings();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get("/ops/stats");
        setStats(response.data);
        setError(null);
      } catch (err) {
        setError("Failed to fetch LLMOps stats. Is the backend running?");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 10 seconds
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50">
        System Status
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        
        <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                {aiMode === 'enterprise' ? 'Enterprise Resources' : 'Local Hardware'}
            </h3>
            {aiMode === 'enterprise' ? <EnterpriseResources /> : <SystemResources />}
        </section>

        {/* LLM Ops Section */}
        <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                LLM Operations
            </h3>
            {loading && !stats && <p className="text-muted-foreground">Loading stats...</p>}
            {error && <p className="text-destructive">{error}</p>}
            {stats && (
            <div className="@container">
              <div className="grid gap-4 grid-cols-1 @[400px]:grid-cols-2">
                  <StatCard
                  title="Total Requests"
                  value={stats.total_requests}
                  icon={<BarChart className="h-4 w-4 text-muted-foreground" />}
                  />
                  <StatCard
                  title="Avg Latency"
                  value={`${stats.avg_latency.toFixed(0)}`}
                  unit="ms"
                  icon={<Zap className="h-4 w-4 text-muted-foreground" />}
                  />
                  <StatCard
                  title="Error Rate"
                  value={`${stats.error_rate.toFixed(2)}`}
                  unit="%"
                  icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
                  />
                  <StatCard
                  title="Est. Cost Saved"
                  value={`$${stats.estimated_cost_saved.toFixed(2)}`}
                  icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
                  />
              </div>
            </div>
            )}
        </section>

        <div className="text-xs text-muted-foreground pt-4 border-t border-border/50">
            {aiMode === 'local' && 'Hardware stats refresh automatically. '}
            LLM Ops provides real-time observability into model performance.
        </div>
      </div>
    </div>
  );
}

