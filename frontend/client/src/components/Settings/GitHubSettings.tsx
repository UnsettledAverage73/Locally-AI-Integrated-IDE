import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Github, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import axios from "axios";

export default function GitHubSettings() {
  const { toast } = useToast();
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setChecking(true);
      const res = await axios.get("http://localhost:8000/config/env");
      setHasToken(res.data.has_github_token);
    } catch (error) {
      console.error("Failed to check GitHub status", error);
    } finally {
      setChecking(false);
    }
  };

  const handleSave = async () => {
    if (!token) return;
    
    try {
      setLoading(true);
      await axios.post("http://localhost:8000/config/env", {
        github_token: token
      });
      
      setHasToken(true);
      setToken(""); // Clear input for security
      
      toast({
        title: "GitHub Token Saved",
        description: "Your Personal Access Token has been securely stored.",
        className: "bg-green-500/10 border-green-500/50 text-green-500",
      });
    } catch (error) {
      toast({
        title: "Error Saving Token",
        description: "Could not save the configuration.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 border border-white/10 bg-white/5 rounded-xl space-y-4">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-white/10 rounded-full">
            <Github className="w-6 h-6" />
          </div>
          <div className="space-y-1 flex-1">
            <h3 className="font-medium text-lg">GitHub Integration</h3>
            <p className="text-sm text-muted-foreground">
              Connect your GitHub account to enable features like listing issues, creating pull requests, and reading private repositories directly from the IDE.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm">
                Status: 
                {checking ? (
                    <span className="flex items-center text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin mr-1"/> Checking...</span>
                ) : hasToken ? (
                    <span className="flex items-center text-green-500 font-medium"><CheckCircle className="w-4 h-4 mr-1"/> Connected</span>
                ) : (
                    <span className="flex items-center text-yellow-500 font-medium"><AlertCircle className="w-4 h-4 mr-1"/> Not Configured</span>
                )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="gh-token">Personal Access Token (PAT)</Label>
            <div className="flex gap-2">
                <Input
                  id="gh-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={hasToken ? "••••••••••••••••••••••••" : "ghp_..."}
                  className="bg-background/50"
                />
                <Button onClick={handleSave} disabled={loading || !token}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : "Save Token"}
                </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
                Generate a token with <code>repo</code> scope at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">GitHub Settings</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
