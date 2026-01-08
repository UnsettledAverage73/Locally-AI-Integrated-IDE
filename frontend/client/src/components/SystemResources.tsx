import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { system } from "@/api/client";
import { Zap, Cpu, Activity, Server, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface SystemStats {
  cpu?: string;
  ram?: string;
  gpu?: { available: boolean; name: string; vram: string; load: string };
  ollama?: { status: string; mode: string };
  // Legacy
  ram_total_gb?: number;
  ram_available_gb?: number;
}

export default function SystemResources() {
  const [stats, setStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await system.getStats();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch system stats:", error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);

    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="h-24 bg-muted/50" />
        ))}
      </div>
    );
  }

  const isGpuAvailable = stats.gpu?.available;
  const isOllamaOnline = stats.ollama?.status === "online";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* CPU Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.cpu || "0%"}</div>
          <p className="text-xs text-muted-foreground">
            System Load
          </p>
        </CardContent>
      </Card>

      {/* RAM Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Memory</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.ram || "0%"}</div>
          <p className="text-xs text-muted-foreground">
            {stats.ram_available_gb}GB free of {stats.ram_total_gb}GB
          </p>
        </CardContent>
      </Card>

      {/* GPU Card */}
      <Card className={cn(
        "transition-all duration-300",
        isGpuAvailable ? "border-green-500/50 bg-green-500/5 shadow-[0_0_15px_rgba(34,197,94,0.1)]" : "opacity-70 bg-muted/30"
      )}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">GPU Acceleration</CardTitle>
          <Zap className={cn("h-4 w-4", isGpuAvailable ? "text-green-500 fill-green-500" : "text-muted-foreground")} />
        </CardHeader>
        <CardContent>
          {isGpuAvailable ? (
            <>
              <div className="text-lg font-bold truncate" title={stats.gpu?.name}>{stats.gpu?.name}</div>
              <div className="flex justify-between text-xs text-green-600/80 mt-1 font-medium">
                <span>Load: {stats.gpu?.load}</span>
                <span>VRAM: {stats.gpu?.vram}</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-xl font-bold text-muted-foreground">Integrated</div>
              <p className="text-xs text-muted-foreground">No Dedicated GPU</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Ollama Status Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">AI Engine</CardTitle>
          <Server className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="flex items-center gap-2">
                <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", isOllamaOnline ? "bg-green-500" : "bg-red-500")} />
                <div className="text-2xl font-bold capitalize">{stats.ollama?.status}</div>
            </div>
          <p className="text-xs text-muted-foreground mt-1">
             Mode: {stats.ollama?.mode || "Unknown"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
