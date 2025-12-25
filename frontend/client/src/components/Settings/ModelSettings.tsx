import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { llm, system } from "@/api/client";
import { useToast } from "@/hooks/use-toast";
import { useDownload } from "@/context/DownloadContext";
import { Loader2, Trash2, Download, HardDrive, Cpu, AlertTriangle, Check } from "lucide-react";

interface ModelOption {
  name: string;
  label: string;
  size_gb: number; // Approx download size
  min_ram_gb: number;
}
// ... KNOWN_MODELS kept as is ...
const KNOWN_MODELS: ModelOption[] = [
  { name: "qwen2.5:0.5b", label: "Qwen 2.5 (0.5B) - Tiny/Fast", size_gb: 0.4, min_ram_gb: 2 },
  { name: "gemma:2b", label: "Gemma (2B) - Light", size_gb: 1.5, min_ram_gb: 4 },
  { name: "llama3.2:3b", label: "Llama 3.2 (3B) - Balanced", size_gb: 2.0, min_ram_gb: 8 },
  { name: "deepseek-coder", label: "DeepSeek Coder (Standard)", size_gb: 4.0, min_ram_gb: 8 },
  { name: "llama3:8b", label: "Llama 3 (8B) - Smart", size_gb: 4.7, min_ram_gb: 12 },
  { name: "mistral", label: "Mistral (7B)", size_gb: 4.1, min_ram_gb: 12 },
  { name: "llama3:70b", label: "Llama 3 (70B) - Genius", size_gb: 40, min_ram_gb: 48 }, 
];

export default function ModelSettings() {
  const { toast } = useToast();
  const { startDownload, isDownloading, modelName: downloadingModelName, progress } = useDownload();
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  // ... rest of state ...
  const [systemStats, setSystemStats] = useState<{
    ram_total_gb: number;
    ram_available_gb: number;
    disk_total_gb: number;
    disk_free_gb: number;
  } | null>(null);
  
  const [loading, setLoading] = useState(false);
  // removed pullingModel local state
  const [profile, setProfile] = useState("balanced");
  const [activeModel, setActiveModel] = useState("deepseek-coder");

  // ... useEffect ...
  useEffect(() => {
    loadData();
    const savedProfile = localStorage.getItem("ai_profile") || "balanced";
    setProfile(savedProfile);
    const savedModel = localStorage.getItem("ai_model") || "deepseek-coder";
    setActiveModel(savedModel);
  }, [isDownloading]); // Reload when download status changes

  // ... loadData ...
  const loadData = async () => {
    setLoading(true);
    try {
      const [modelsData, statsData] = await Promise.all([
        llm.models(),
        system.getStats(),
      ]);
      setInstalledModels(modelsData.models);
      setSystemStats(statsData);
    } catch (error) {
      console.error("Failed to load settings data", error);
    } finally {
      setLoading(false);
    }
  };

  const handleModelChange = (val: string) => {
    setActiveModel(val);
    localStorage.setItem("ai_model", val);
  };

  const handlePullModel = (modelName: string) => {
    startDownload(modelName);
  };

  const handleDeleteModel = async (modelName: string) => {
    // ... same as before ...
    if (!confirm(`Are you sure you want to delete ${modelName}?`)) return;
    try {
        await llm.deleteModel(modelName);
        toast({ title: "Model Deleted", description: `${modelName} has been removed.` });
        await loadData();
    } catch (error) {
        toast({ title: "Delete Failed", description: "Could not delete model.", variant: "destructive" });
    }
  };
  
  const handleProfileChange = (val: string) => {
    setProfile(val);
    localStorage.setItem("ai_profile", val);
    let temp = 0.7;
    if (val === "creative") temp = 0.9;
    if (val === "strict") temp = 0.1;
    localStorage.setItem("ai_temperature", temp.toString());
  };

  const availableRam = systemStats?.ram_total_gb || 0;
  const availableDisk = systemStats?.disk_free_gb || 0;
  const isDiskCritical = availableDisk < 5;
  
  const filteredModels = KNOWN_MODELS.filter(m => {
    if (availableRam < 8) {
        return m.name.includes("1b") || m.name.includes("2b") || m.name.includes("3b") || m.name.includes("0.5b");
    }
    return true; 
  });

  return (
    <div className="space-y-6">
      {/* System Stats Header - Same as before */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 border rounded-lg bg-accent/5 flex items-center space-x-3">
            <Cpu className="w-5 h-5 text-primary" />
            <div>
                <div className="text-xs text-muted-foreground">System RAM</div>
                <div className="font-semibold">{systemStats?.ram_total_gb} GB</div>
            </div>
        </div>
        <div className={`p-3 border rounded-lg bg-accent/5 flex items-center space-x-3 ${isDiskCritical ? 'border-red-500/50 bg-red-500/10' : ''}`}>
            <HardDrive className={`w-5 h-5 ${isDiskCritical ? 'text-red-500' : 'text-primary'}`} />
            <div>
                <div className="text-xs text-muted-foreground">Free Disk Space</div>
                <div className="font-semibold">{systemStats?.disk_free_gb} GB</div>
            </div>
        </div>
      </div>

      {isDiskCritical && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-500 bg-red-500/10 rounded-md border border-red-500/20">
            <AlertTriangle className="w-4 h-4" />
            <span>Low disk space! Model downloads are disabled (&lt; 5GB free).</span>
        </div>
      )}

      {/* Active Model & Profile Selectors */}
      <div className="space-y-4">
        <div className="space-y-2">
            <Label>Active Chat Model</Label>
            <Select value={activeModel} onValueChange={handleModelChange}>
                <SelectTrigger>
                    <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                    {installedModels.length === 0 ? (
                        <SelectItem value="deepseek-coder" disabled>No models installed</SelectItem>
                    ) : (
                        installedModels.map(model => (
                            <SelectItem key={model} value={model}>{model}</SelectItem>
                        ))
                    )}
                </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Choose the model to use for AI chat and code generation.</p>
        </div>

        <div className="space-y-2">
            <Label>Reasoning Profile</Label>
            <Select value={profile} onValueChange={handleProfileChange}>
                <SelectTrigger>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="creative">Creative (Temp 0.9) - Good for brainstorming</SelectItem>
                    <SelectItem value="balanced">Balanced (Temp 0.7) - General purpose</SelectItem>
                    <SelectItem value="strict">Strict Coding (Temp 0.1) - Good for syntax/logic</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      {/* Installed Models List - Same as before */}
      <div className="space-y-2">
        <Label>Installed Models</Label>
        <div className="border rounded-md divide-y">
            {installedModels.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">No models installed.</div>
            ) : (
                installedModels.map(model => (
                    <div key={model} className="flex items-center justify-between p-3 text-sm">
                        <span>{model}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteModel(model)}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                ))
            )}
        </div>
      </div>

      {/* Available Models */}
      <div className="space-y-2">
        <Label>Available Models (Recommended for your Hardware)</Label>
        <div className="grid gap-2">
            {filteredModels.map((model) => {
                const isInstalled = installedModels.some(m => m.includes(model.name));
                const isTooBigForDisk = model.size_gb > availableDisk;
                const canDownload = !isInstalled && !isDiskCritical && !isTooBigForDisk;
                const isCurrentlyDownloading = isDownloading && downloadingModelName === model.name;

                return (
                    <div key={model.name} className="flex items-center justify-between p-3 border rounded-md bg-card">
                        <div>
                            <div className="font-medium">{model.label}</div>
                            <div className="text-xs text-muted-foreground">Size: {model.size_gb}GB • RAM Req: {model.min_ram_gb}GB</div>
                        </div>
                        {isInstalled ? (
                            <Button size="sm" variant="secondary" disabled className="gap-2">
                                <Check className="w-4 h-4" /> Installed
                            </Button>
                        ) : (
                            <Button 
                                size="sm" 
                                variant="outline" 
                                disabled={!canDownload || isDownloading}
                                onClick={() => handlePullModel(model.name)}
                            >
                                {isCurrentlyDownloading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        {progress}%
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4 mr-2" />
                                        Get
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                );
            })}
        </div>
      </div>
    </div>
  );
}
