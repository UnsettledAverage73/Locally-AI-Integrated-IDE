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
import { useToast } from "@/hooks/use-toast";
import axios from "axios";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState("local");
  const [awsAccessKey, setAwsAccessKey] = useState("");
  const [awsSecretKey, setAwsSecretKey] = useState("");
  const [awsSessionToken, setAwsSessionToken] = useState("");
  const [awsRegion, setAwsRegion] = useState("us-east-1");

  useEffect(() => {
    if (isOpen) {
        // Fetch current config status
        // NOTE: We only fetch the "mode" and "has_keys" status.
        // We DO NOT fetch the actual credentials back from the server for security.
        // This ensures secrets are not exposed to the frontend after being set.
        axios.get("http://localhost:8000/config/status").then((res) => {
            setMode(res.data.mode);
        }).catch(err => console.error("Failed to fetch config", err));
    }
  }, [isOpen]);

  const handleSave = async () => {
    try {
      await axios.post("http://localhost:8000/config/update", {
        mode,
        aws_access_key: awsAccessKey || undefined,
        aws_secret_key: awsSecretKey || undefined,
        aws_session_token: awsSessionToken || undefined,
        aws_region: awsRegion,
      });
      
      toast({
        title: "Settings Saved",
        description: `Switched to ${mode === 'local' ? 'Local (Ollama)' : 'Cloud (Bedrock)'} mode.`,
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] bg-card/95 backdrop-blur border-border text-foreground">
        <DialogHeader>
          <DialogTitle>Environment Settings</DialogTitle>
          <DialogDescription>Configure your AI provider.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
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
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
