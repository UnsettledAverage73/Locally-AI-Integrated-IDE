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
import { Paintbrush, Moon, Sun, Monitor, Loader2, Check, WifiOff, Server, Wifi, Copy, Terminal } from "lucide-react";
import { useSettings } from "@/context/SettingsContext";
import { cn } from "@/lib/utils";
import ModelSettings from "./ModelSettings";
import GitHubSettings from "./GitHubSettings";
import { llm, cloud } from "@/api/client";
import { Search } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const THEMES = [
  { id: "default", name: "Midnight (Default)", icon: Moon },
  { id: "theme-vscode-dark", name: "VS Code Dark", icon: Monitor },
  { id: "theme-github-light", name: "GitHub Light", icon: Sun },
  { id: "theme-dracula", name: "Dracula", icon: Paintbrush },
  { id: "theme-monokai", name: "Monokai", icon: Monitor },
  { id: "theme-solarized-dark", name: "Solarized Dark", icon: Monitor },
];

export default function SettingsModal({ isOpen, onOpenChange }: SettingsModalProps) {
  const { toast } = useToast();
  const { aiMode, setAiMode, enterpriseHost, setEnterpriseHost } = useSettings();
  const [activeTab, setActiveTab] = useState("environment");
  const [currentTheme, setCurrentTheme] = useState("default");
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'pending'>('pending');
  const [discoveredInstances, setDiscoveredInstances] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [awsCreds, setAwsCreds] = useState(() => {
    try {
      const saved = localStorage.getItem('aws_provisioning_creds');
      return saved ? JSON.parse(saved) : { accessKey: '', secretKey: '', sessionToken: '' };
    } catch {
      return { accessKey: '', secretKey: '', sessionToken: '' };
    }
  });
  const [selectedInstanceType, setSelectedInstanceType] = useState('t3.small');
  const [selectedRegion, setSelectedRegion] = useState('us-east-1');
  const [storageGb, setStorageGb] = useState(30);

  const [selectedProvider, setSelectedProvider] = useState<'aws' | 'gcp' | 'azure'>('aws');
  const [gcpCreds, setGcpCreds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gcp_provisioning_creds') || '{}') || { projectId: '', credentialsJson: '' }; }
    catch { return { projectId: '', credentialsJson: '' }; }
  });
  const [azureCreds, setAzureCreds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('azure_provisioning_creds') || '{}') || { subscriptionId: '', tenantId: '', clientId: '', clientSecret: '' }; }
    catch { return { subscriptionId: '', tenantId: '', clientId: '', clientSecret: '' }; }
  });

  useEffect(() => {
    localStorage.setItem('gcp_provisioning_creds', JSON.stringify(gcpCreds));
  }, [gcpCreds]);

  useEffect(() => {
    localStorage.setItem('azure_provisioning_creds', JSON.stringify(azureCreds));
  }, [azureCreds]);


  useEffect(() => {
    localStorage.setItem('aws_provisioning_creds', JSON.stringify(awsCreds));
  }, [awsCreds]);
  const [provisionLogs, setProvisionLogs] = useState<{message: string, status: string}[]>([]);

  useEffect(() => {
    const logsContainer = document.getElementById("logs-end");
    if (logsContainer) {
      logsContainer.scrollIntoView({ behavior: "smooth" });
    }
  }, [provisionLogs]);

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

  const handleDiscover = async () => {
    setIsDiscovering(true);
    try {
        const { results } = await cloud.discover();
        setDiscoveredInstances(results);
        if (results.length === 0) {
            toast({ title: "No instances found", description: "Could not find any Ollama instances on your local network.", variant: "destructive" });
        } else {
            toast({ title: "Discovery Complete", description: `Found ${results.length} potential AI hosts.`, className: "bg-green-500/10" });
        }
    } catch (e) {
        toast({ title: "Discovery Failed", description: "Error scanning network.", variant: "destructive" });
    } finally {
        setIsDiscovering(false);
    }
  };

  const handleProvision = async () => {
    let payload: any = { provider: selectedProvider, storage_gb: storageGb };
    if (selectedProvider === 'aws') {
        if (!awsCreds.accessKey || !awsCreds.secretKey) return toast({ title: "Missing Credentials", description: "Please provide AWS keys.", variant: "destructive" });
        payload = { ...payload, aws_access_key: awsCreds.accessKey, aws_secret_key: awsCreds.secretKey, aws_session_token: awsCreds.sessionToken, region: selectedRegion, instance_type: selectedInstanceType };
    } else if (selectedProvider === 'gcp') {
        if (!gcpCreds.projectId || !gcpCreds.credentialsJson) return toast({ title: "Missing Credentials", description: "Please provide GCP Project ID and JSON.", variant: "destructive" });
        payload = { ...payload, gcp_project_id: gcpCreds.projectId, gcp_credentials_json: gcpCreds.credentialsJson, zone: selectedRegion, machine_type: selectedInstanceType };
    } else if (selectedProvider === 'azure') {
        if (!azureCreds.subscriptionId || !azureCreds.tenantId || !azureCreds.clientId || !azureCreds.clientSecret) return toast({ title: "Missing Credentials", description: "Please provide all Azure credentials.", variant: "destructive" });
        payload = { ...payload, ...azureCreds, location: selectedRegion, vm_size: selectedInstanceType };
    }

    setIsProvisioning(true);
    setProvisionLogs([{ message: `🔌 Connecting to ${selectedProvider.toUpperCase()} provisioning service...`, status: "info" }]);
    
    const socket = new WebSocket("ws://127.0.0.1:8000/cloud/ws/provision");
    
    socket.onopen = () => {
        socket.send(JSON.stringify(payload));
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
            setProvisionLogs(prev => [...prev, { message: data.message, status: data.status }]);
        } else if (data.type === 'complete') {
            setProvisionLogs(prev => [...prev, { message: "🔌 Service Ready! Finalizing connection...", status: "success" }]);
            toast({ title: "Cloud AI Ready", description: `Connected to ${data.public_ip}!`, className: "bg-green-500/10" });
            setEnterpriseHost(data.url);
            handleTestConnection(data.url);
            setIsProvisioning(false);
            socket.close();
        } else if (data.type === 'error') {
            toast({ title: "Provisioning Failed", description: data.message, variant: "destructive" });
            setProvisionLogs(prev => [...prev, { message: `❌ Error: ${data.message}`, status: "error" }]);
            setIsProvisioning(false);
            socket.close();
        }
    };

    socket.onerror = (error) => {
        console.error("Provisioning WebSocket error:", error);
        toast({ title: "Connection Error", description: "WebSocket connection failed.", variant: "destructive" });
        setIsProvisioning(false);
    };
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
      onOpenChange(false);
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
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
                        <div className="space-y-4 pl-2 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                                <Label htmlFor="enterprise-url">Endpoint URL</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="enterprise-url"
                                        value={enterpriseHost}
                                        onChange={(e) => setEnterpriseHost(e.target.value)}
                                        placeholder="http://your-company-ai.net:11434"
                                    />
                                    {connectionStatus === 'connected' && <Check className="w-5 h-5 text-green-500" />}
                                    {connectionStatus === 'disconnected' && <WifiOff className="w-5 h-5 text-red-500" />}
                                    {connectionStatus === 'pending' && <Loader2 className="w-5 h-5 animate-spin" />}
                                </div>
                                <Button onClick={() => handleTestConnection(enterpriseHost)} size="sm" className="mt-2" disabled={connectionStatus === 'pending'}>
                                    {connectionStatus === 'pending' ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : null}
                                    Test Connection
                                </Button>
                            </div>

                            <div className="pt-4 border-t border-border/30">
                                <div className="flex items-center justify-between mb-2">
                                    <Label className="text-sm font-medium">Auto-Discovery</Label>
                                    <Button variant="outline" size="sm" onClick={handleDiscover} disabled={isDiscovering}>
                                        {isDiscovering ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Search className="w-3 h-3 mr-2" />}
                                        Scan Network
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mb-3">Scanning for private cloud instances on your local subnet...</p>
                                
                                {discoveredInstances.length > 0 && (
                                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 no-scrollbar">
                                        {discoveredInstances.map((instance, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-accent/10 border border-border/50 hover:bg-accent/20 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-mono">{instance.url}</span>
                                                    <span className="text-[10px] text-muted-foreground">{instance.models.length} models available</span>
                                                </div>
                                                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => {
                                                    setEnterpriseHost(instance.url);
                                                    handleTestConnection(instance.url);
                                                }}>Connect</Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-border/30">
                                <Label className="text-sm font-medium">Provision Private Cloud</Label>
                                <p className="text-[10px] text-muted-foreground mb-3">Deploy and configure an AI server on your preferred cloud provider.</p>
                                
                                <div className="flex gap-2 mb-4">
                                    <Button variant={selectedProvider === 'aws' ? 'default' : 'outline'} onClick={() => setSelectedProvider('aws')} className="flex-1 text-xs h-8">AWS</Button>
                                    <Button variant={selectedProvider === 'gcp' ? 'default' : 'outline'} onClick={() => setSelectedProvider('gcp')} className="flex-1 text-xs h-8">GCP</Button>
                                    <Button variant={selectedProvider === 'azure' ? 'default' : 'outline'} onClick={() => setSelectedProvider('azure')} className="flex-1 text-xs h-8">Azure</Button>
                                </div>

                                <div className="space-y-3">
                                    <div className="grid grid-cols-3 gap-2">
                                        {(selectedProvider === 'aws' ? [
                                            { id: 't3.small', label: 'small', desc: 'Std' },
                                            { id: 't3.medium', label: 'medium', desc: 'Mid' },
                                            { id: 't3.xlarge', label: 'xlarge', desc: 'High' }
                                        ] : selectedProvider === 'gcp' ? [
                                            { id: 'e2-medium', label: 'medium', desc: 'Std' },
                                            { id: 'e2-standard-2', label: 'standard', desc: 'Mid' },
                                            { id: 'n2-standard-4', label: 'high', desc: 'High' }
                                        ] : [
                                            { id: 'Standard_B2s', label: 'B2s', desc: 'Std' },
                                            { id: 'Standard_D2s_v3', label: 'D2s', desc: 'Mid' },
                                            { id: 'Standard_D4s_v3', label: 'D4s', desc: 'High' }
                                        ]).map((type) => (
                                            <div 
                                                key={type.id}
                                                onClick={() => setSelectedInstanceType(type.id)}
                                                className={cn(
                                                    "cursor-pointer flex flex-col items-center p-2 rounded border text-[10px] transition-all",
                                                    selectedInstanceType === type.id ? "border-primary bg-primary/10" : "border-border hover:bg-white/5"
                                                )}
                                            >
                                                <span className="font-bold">{type.label}</span>
                                                <span className="text-muted-foreground opacity-60 text-[8px] uppercase">{type.desc}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase opacity-60">Region</Label>
                                            <select 
                                                value={selectedRegion}
                                                onChange={(e) => setSelectedRegion(e.target.value)}
                                                className="w-full h-8 bg-transparent border border-border rounded text-[10px] px-2 outline-none focus:border-primary"
                                            >
                                                {selectedProvider === 'aws' && <>
                                                    <option value="us-east-1" className="bg-[#0d0d0d]">us-east-1</option>
                                                    <option value="us-west-2" className="bg-[#0d0d0d]">us-west-2</option>
                                                    <option value="eu-west-1" className="bg-[#0d0d0d]">eu-west-1</option>
                                                    <option value="ap-south-1" className="bg-[#0d0d0d]">ap-south-1</option>
                                                </>}
                                                {selectedProvider === 'gcp' && <>
                                                    <option value="us-central1-a" className="bg-[#0d0d0d]">us-central1-a</option>
                                                    <option value="us-west1-b" className="bg-[#0d0d0d]">us-west1-b</option>
                                                    <option value="europe-west1-b" className="bg-[#0d0d0d]">europe-west1-b</option>
                                                </>}
                                                {selectedProvider === 'azure' && <>
                                                    <option value="eastus" className="bg-[#0d0d0d]">eastus</option>
                                                    <option value="westus" className="bg-[#0d0d0d]">westus</option>
                                                    <option value="westeurope" className="bg-[#0d0d0d]">westeurope</option>
                                                </>}
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase opacity-60">Storage (GB)</Label>
                                            <Input
                                                type="number"
                                                min="20"
                                                max="500"
                                                value={storageGb}
                                                onChange={(e) => setStorageGb(parseInt(e.target.value))}
                                                className="h-8 text-[10px]"
                                            />
                                        </div>
                                    </div>

                                    {selectedProvider === 'aws' && <>
                                        <Input placeholder="AWS Access Key ID" value={awsCreds.accessKey} onChange={(e) => setAwsCreds({...awsCreds, accessKey: e.target.value})} className="text-xs" />
                                        <Input type="password" placeholder="AWS Secret Access Key" value={awsCreds.secretKey} onChange={(e) => setAwsCreds({...awsCreds, secretKey: e.target.value})} className="text-xs" />
                                        <Input type="password" placeholder="AWS Session Token (Optional)" value={awsCreds.sessionToken} onChange={(e) => setAwsCreds({...awsCreds, sessionToken: e.target.value})} className="text-xs" />
                                    </>}
                                    {selectedProvider === 'gcp' && <>
                                        <Input placeholder="GCP Project ID" value={gcpCreds.projectId} onChange={(e) => setGcpCreds({...gcpCreds, projectId: e.target.value})} className="text-xs" />
                                        <Input type="password" placeholder="Service Account JSON (paste content)" value={gcpCreds.credentialsJson} onChange={(e) => setGcpCreds({...gcpCreds, credentialsJson: e.target.value})} className="text-xs" />
                                    </>}
                                    {selectedProvider === 'azure' && <>
                                        <Input placeholder="Subscription ID" value={azureCreds.subscriptionId} onChange={(e) => setAzureCreds({...azureCreds, subscriptionId: e.target.value})} className="text-xs" />
                                        <Input placeholder="Tenant ID" value={azureCreds.tenantId} onChange={(e) => setAzureCreds({...azureCreds, tenantId: e.target.value})} className="text-xs" />
                                        <Input placeholder="Client ID" value={azureCreds.clientId} onChange={(e) => setAzureCreds({...azureCreds, clientId: e.target.value})} className="text-xs" />
                                        <Input type="password" placeholder="Client Secret" value={azureCreds.clientSecret} onChange={(e) => setAzureCreds({...azureCreds, clientSecret: e.target.value})} className="text-xs" />
                                    </>}
                                    <Button onClick={handleProvision} size="sm" disabled={isProvisioning} className="w-full mt-2">
                                        {isProvisioning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Server className="w-4 h-4 mr-2" />}
                                        {isProvisioning ? "Deploying..." : "Deploy EC2 Instance"}
                                    </Button>
                                </div>

                                {provisionLogs.length > 0 && (
                                    <div className="mt-4 rounded-lg bg-[#0d0d0d] border border-white/10 overflow-hidden shadow-2xl flex flex-col group/terminal">
                                        <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10">
                                            <div className="flex items-center gap-2">
                                                <Terminal className="w-3 h-3 text-muted-foreground" />
                                                <span className="text-muted-foreground uppercase tracking-wider text-[9px] font-bold">Deployment Logs</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="w-6 h-6 hover:bg-white/10" 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const logText = provisionLogs.map(l => l.message).join('\n');
                                                        navigator.clipboard.writeText(logText);
                                                        toast({ title: "Copied to clipboard", duration: 2000 });
                                                    }}
                                                    title="Copy Logs"
                                                >
                                                    <Copy className="w-3 h-3 text-muted-foreground" />
                                                </Button>
                                                {isProvisioning && <div className="flex gap-1">
                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                                    <span className="w-1.5 h-1.5 bg-green-500/60 rounded-full animate-pulse delay-75" />
                                                    <span className="w-1.5 h-1.5 bg-green-500/30 rounded-full animate-pulse delay-150" />
                                                </div>}
                                            </div>
                                        </div>
                                        <div className="p-3 font-mono text-[10px] space-y-1.5 max-h-60 overflow-y-auto no-scrollbar scroll-smooth selection:bg-primary/40">
                                            {provisionLogs.map((log, i) => (
                                                <div key={i} className={cn(
                                                    "break-words py-0.5 border-l-2 pl-3 transition-all duration-300",
                                                    log.status === 'error' ? "text-red-400 border-red-500 bg-red-500/5" : 
                                                    log.status === 'success' ? "text-green-400 border-green-500 bg-green-500/5" : 
                                                    "text-blue-300/80 border-blue-500/20"
                                                )}>
                                                    {log.message}
                                                </div>
                                            ))}
                                            <div id="logs-end" />
                                        </div>
                                    </div>
                                )}
                            </div>
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
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
