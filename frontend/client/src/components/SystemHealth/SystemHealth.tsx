import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Zap, AlertTriangle, BarChart } from "lucide-react";
import { apiClient } from "@/api/client"; 
import SystemResources from "../SystemResources";

interface OpsStats {
  avg_latency: number;
  total_requests: number;
  error_rate: number;
  estimated_cost_saved: number;
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

export default function SystemHealth() {
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        
        {/* Hardware Section */}
        <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                Hardware Resources
            </h3>
            <SystemResources />
        </section>

        {/* LLM Ops Section */}
        <section>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                LLM Operations
            </h3>
            {loading && !stats && <p className="text-muted-foreground">Loading stats...</p>}
            {error && <p className="text-destructive">{error}</p>}
            {stats && (
            <div className="grid gap-4 md:grid-cols-2">
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
            )}
        </section>

        <div className="text-xs text-muted-foreground pt-4 border-t border-border/50">
            Stats refresh automatically. This dashboard provides real-time observability into the performance and cost-efficiency of the locally-run models.
        </div>
      </div>
    </div>
  );
}
