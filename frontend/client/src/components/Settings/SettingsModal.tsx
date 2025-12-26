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
import { Paintbrush, Moon, Sun, Monitor } from "lucide-react";
import axios from "axios";
import ModelSettings from "./ModelSettings";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const THEMES = [
  { id: "default", name: "Midnight (Default)", icon: Moon },
  { id: "theme-light", name: "Light", icon: Sun },
  { id: "theme-dracula", name: "Dracula", icon: Paintbrush },
  { id: "theme-monokai", name: "Monokai", icon: Monitor },
];

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("environment");
  const [mode, setMode] = useState("local");
  const [awsAccessKey, setAwsAccessKey] = useState("");
  const [awsSecretKey, setAwsSecretKey] = useState("");
  const [awsSessionToken, setAwsSessionToken] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");
  const [currentTheme, setCurrentTheme] = useState("default");

  useEffect(() => {
    if (isOpen) {
        // Fetch current config status
        axios.get("http://localhost:8000/config/status").then((res) => {
            setMode(res.data.mode);
        }).catch(err => console.error("Failed to fetch config", err));
        
        // Load Theme
        const savedTheme = localStorage.getItem("ui_theme") || "default";
        setCurrentTheme(savedTheme);
    }
  }, [isOpen]);

  const handleSave = async () => {
    try {
      // Save Config
      await axios.post("http://localhost:8000/config/update", {
        mode,
        aws_access_key: awsAccessKey || undefined,
        aws_secret_key: awsSecretKey || undefined,
        aws_session_token: awsSessionToken || undefined,
        aws_region: awsRegion,
      });
      
      // Save Theme
      localStorage.setItem("ui_theme", currentTheme);
      document.documentElement.className = currentTheme === "default" ? "" : currentTheme;

      toast({
        title: "Settings Saved",
        description: `Configuration and appearance updated.`,
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
      <DialogContent className="sm:max-w-[600px] bg-card/95 backdrop-blur border-border text-foreground max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Configure your environment, AI models, and appearance.</DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="environment" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="environment">Environment</TabsTrigger>
                <TabsTrigger value="models">Models</TabsTrigger>
                <TabsTrigger value="appearance">Appearance</TabsTrigger>
            </TabsList>

            <TabsContent value="environment" className="py-4">
                <div className="grid gap-6">
                  <div className="grid gap-3">
                    <Label>AI Backend</Label>
                    <RadioGroup defaultValue={mode} value={mode} onValueChange={setMode} className="flex gap-4">
                      <div className="flex items-center space-x-2 border border-border p-3 rounded-md w-full hover:bg-accent/5 cursor-pointer">
                        <RadioGroupItem value="local" id="local" />
                        <Label htmlFor="local" className="cursor-pointer">Local (Ollama)</Label>
                      </div>
                      <div className="flex items-center space-x-2 border border-border p-3 rounded-md w-full hover:bg-accent/5 cursor-pointer">
                        <RadioGroupItem value="cloud" id="cloud" />
                        <Label htmlFor="cloud" className="cursor-pointer">Cloud (AWS)</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {mode === "cloud" && (
                    <div className="space-y-4 border-t border-border pt-4 animate-in fade-in slide-in-from-top-2">
                      <div className="grid gap-2">
                        <Label htmlFor="access-key">AWS Access Key</Label>
                        <Input
                          id="access-key"
                          type="password"
                          value={awsAccessKey}
                          onChange={(e) => setAwsAccessKey(e.target.value)}
                          placeholder="AKIA..."
                          className="bg-background/50"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="secret-key">AWS Secret Key</Label>
                        <Input
                          id="secret-key"
                          type="password"
                          value={awsSecretKey}
                          onChange={(e) => setAwsSecretKey(e.target.value)}
                          placeholder="Secret..."
                          className="bg-background/50"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="session-token">Session Token (Optional)</Label>
                        <Input
                          id="session-token"
                          type="password"
                          value={awsSessionToken}
                          onChange={(e) => setAwsSessionToken(e.target.value)}
                          placeholder="Token..."
                          className="bg-background/50"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="region">Region</Label>
                        <Input
                          id="region"
                          value={awsRegion}
                          onChange={(e) => setAwsRegion(e.target.value)}
                          placeholder="us-east-1"
                          className="bg-background/50"
                        />
                      </div>
                    </div>
                  )}
                </div>
            </TabsContent>

            <TabsContent value="models" className="py-4">
                <ModelSettings />
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
