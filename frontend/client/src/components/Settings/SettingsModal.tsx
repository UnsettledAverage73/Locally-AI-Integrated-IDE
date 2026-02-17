import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Paintbrush, Moon, Sun, Monitor, Loader2, Check, WifiOff, Server, Wifi } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import ModelSettings from "./ModelSettings";
import GitHubSettings from "./GitHubSettings";
import { llm } from "@/api/client";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEMES = [
  { id: "default", name: "Midnight (Default)", icon: Moon },
  { id: "theme-github-light", name: "GitHub Light", icon: Sun },
  { id: "theme-dracula", name: "Dracula", icon: Paintbrush },
  { id: "theme-monokai", name: "Monokai", icon: Monitor },
  { id: "theme-solarized-dark", name: "Solarized Dark", icon: Monitor },
];

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { toast } = useToast();
  const { aiMode, setAiMode, enterpriseHost, setEnterpriseHost } = useSettings();
  const [activeTab, setActiveTab] = useState("environment");
  const [currentTheme, setCurrentTheme] = useState("default");
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'pending'>('pending');

  useEffect(() => {
    if (isOpen) {
      // Load Theme
      const savedTheme = localStorage.getItem("ui_theme") || "default";
      setCurrentTheme(savedTheme);
      
      // Test connection on open
      if (aiMode === 'enterprise') {
          handleTestConnection(enterpriseHost, false);
      } else {
          handleTestConnection("http://localhost:11434", false);
      }
    }
  }, [isOpen, aiMode]);

  const handleTestConnection = async (host: string, showToast = true) => {
    if (!host && aiMode === 'enterprise') {
      setConnectionStatus("disconnected");
      if (showToast) toast({ title: "Host URL required", variant: "destructive" });
      return;
    }
    setConnectionStatus("pending");
    try {
      const res = await llm.updateAIHost(aiMode === 'local' ? 'http://localhost:11434' : host);
      if (res.available) {
        setConnectionStatus("connected");
        if (showToast) toast({ title: "Connection Successful", description: `Connected to ${host}`, className: "bg-green-500/10" });
        window.dispatchEvent(new Event('ollamaHostChanged')); // Signal app to refresh
      } else {
        setConnectionStatus("disconnected");
        if (showToast) toast({ title: "Connection Failed", description: "Could not connect to the host.", variant: "destructive" });
      }
    } catch (e) {
      setConnectionStatus("disconnected");
      if (showToast) toast({ title: "Connection Error", description: "An unexpected error occurred.", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    try {
      // Theme is saved separately as it's a UI-only concern
      localStorage.setItem("ui_theme", currentTheme);
      document.documentElement.className = currentTheme === "default" ? "" : currentTheme;

      toast({
        title: "Settings Saved",
        description: `Configuration and appearance updated. Your changes will be fully applied on the next app reload.`,
        className: "bg-green-500/10 border-green-500/50 text-green-500",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Error Saving Settings",
        description: "Could not update configuration.",
        variant: "destructive",
      });
    }
  };

  const applyThemePreview = (themeId: string) => {
      setCurrentTheme(themeId);
      document.documentElement.className = themeId === "default" ? "" : themeId;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-light tracking-wide bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">Settings</DialogTitle>
          <DialogDescription>Configure your environment, AI models, and appearance.</DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="environment" value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
            <TabsList className="grid w-full grid-cols-4 bg-white/5 border border-white/5">
                <TabsTrigger value="environment" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Environment</TabsTrigger>
                <TabsTrigger value="models" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Models</TabsTrigger>
                <TabsTrigger value="github" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">GitHub</TabsTrigger>
                <TabsTrigger value="appearance" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary">Appearance</TabsTrigger>
            </TabsList>

            <TabsContent value="environment" className="py-4 space-y-4">
                <div className="grid gap-6">
                  <div className="grid gap-3">
                    <Label className="text-lg font-light">AI Host Configuration</Label>
                    <RadioGroup value={aiMode} onValueChange={(v) => setAiMode(v as "local" | "enterprise")} className="flex gap-4">
                        <div className="flex items-center space-x-2 border border-border bg-background p-4 rounded-lg w-full hover:bg-accent/50 transition-colors cursor-pointer group">
                            <RadioGroupItem value="local" id="local-host" />
                            <Label htmlFor="local-host" className="flex items-center gap-2 cursor-pointer"> <Server className="w-4 h-4"/> Local Machine</Label>
                        </div>
                        <div className="flex items-center space-x-2 border border-border bg-background p-4 rounded-lg w-full hover:bg-accent/50 transition-colors cursor-pointer group">
                            <RadioGroupItem value="enterprise" id="enterprise-host" />
                            <Label htmlFor="enterprise-host" className="flex items-center gap-2 cursor-pointer"><Wifi className="w-4 h-4" /> Enterprise Endpoint</Label>
                        </div>
                    </RadioGroup>
                    
                    {aiMode === 'enterprise' && (
                        <div className="space-y-2 pl-2 animate-in fade-in slide-in-from-top-2">
                            <Label htmlFor="enterprise-url">Endpoint URL</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    id="enterprise-url"
                                    value={enterpriseHost}
                                    onChange={(e) => setEnterpriseHost(e.target.value)}
                                    placeholder="http://your-company-ai.net:11434"
                                />
                                {connectionStatus === 'connected' && <Check className="w-5 h-5 text-green-500" title="Connected" />}
                                {connectionStatus === 'disconnected' && <WifiOff className="w-5 h-5 text-red-500" title="Connection Failed" />}
                                {connectionStatus === 'pending' && <Loader2 className="w-5 h-5 animate-spin" title="Testing..." />}
                            </div>
                            <Button onClick={() => handleTestConnection(enterpriseHost)} size="sm" className="mt-2">Test Connection</Button>
                        </div>
                    )}
                  </div>
                </div>
            </TabsContent>

            <TabsContent value="models" className="py-4">
                <ModelSettings />
            </TabsContent>

            <TabsContent value="github" className="py-4">
                <GitHubSettings />
            </TabsContent>

            <TabsContent value="appearance" className="py-4">
                <div className="space-y-4">
                    <Label>Color Theme</Label>
                    <div className="grid grid-cols-2 gap-4">
                        {THEMES.map((theme) => {
                            const Icon = theme.icon;
                            return (
                                <div 
                                    key={theme.id}
                                    onClick={() => applyThemePreview(theme.id)}
                                    className={`
                                        cursor-pointer flex items-center p-3 rounded-md border transition-all
                                        ${currentTheme === theme.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent/5"}
                                    `}
                                >
                                    <div className={`p-2 rounded-full mr-3 ${currentTheme === theme.id ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <span className="text-sm font-medium">{theme.name}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
