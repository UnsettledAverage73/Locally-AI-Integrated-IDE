import React from "react";
import { useDownload } from "@/context/DownloadContext";
import { Progress } from "@/components/ui/progress";
import { Download, Minimize2, Loader2, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function DownloadWidget() {
  const { isDownloading, modelName, progress, status, cancelDownload } = useDownload();
  const [isMinimized, setIsMinimized] = React.useState(false);

  if (!isDownloading && progress !== 100) return null;

  // Auto-hide after completion (simple timer or user action? Let's leave it for user to close for now, or just show active)
  if (!isDownloading) return null;

  if (isMinimized) {
    return (
        <div 
            className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground p-3 rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform flex items-center gap-2 animate-in slide-in-from-bottom-5"
            onClick={() => setIsMinimized(false)}
        >
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-bold">{progress}%</span>
        </div>
    );
  }

  return (
    <Card className="fixed bottom-4 right-4 z-50 w-80 p-4 shadow-2xl border-primary/20 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 animate-in slide-in-from-right-10">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-2 rounded-full">
                <Download className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <div>
                <h4 className="font-semibold text-sm">{modelName}</h4>
                <p className="text-xs text-muted-foreground truncate max-w-[150px]">{status}</p>
            </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(true)}>
            <Minimize2 className="w-3 h-3" />
        </Button>
      </div>
      
      <div className="space-y-1">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress}%</span>
            {/* Optional: Add speed or size details here */}
        </div>
      </div>
    </Card>
  );
}
