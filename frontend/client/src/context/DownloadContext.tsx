import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

interface DownloadState {
  modelName: string | null;
  progress: number;
  status: string;
  isDownloading: boolean;
  totalSize?: number;
  completedSize?: number;
}

interface DownloadContextType extends DownloadState {
  startDownload: (modelName: string) => void;
  cancelDownload: () => void; // Note: API might not support cancellation easily yet
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export function DownloadProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [state, setState] = useState<DownloadState>({
    modelName: null,
    progress: 0,
    status: "",
    isDownloading: false,
  });

  const startDownload = (modelName: string) => {
    if (state.isDownloading) {
        toast({ title: "Busy", description: "Already downloading a model." });
        return;
    }

    setState({
        modelName,
        progress: 0,
        status: "Starting...",
        isDownloading: true,
    });

    const ws = new WebSocket("ws://localhost:8000/ws/ollama/pull");

    ws.onopen = () => {
        ws.send(modelName);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.error) {
                toast({ title: "Download Failed", description: data.error, variant: "destructive" });
                ws.close();
                return;
            }

            if (data.status === "done" || data.status === "success") {
                 setState(prev => ({ ...prev, progress: 100, status: "Completed", isDownloading: false }));
                 toast({ title: "Download Complete", description: `${modelName} is ready.` });
                 ws.close();
                 return;
            }

            // Calculate progress
            let progress = 0;
            if (data.total && data.completed) {
                progress = Math.round((data.completed / data.total) * 100);
            }
            
            setState(prev => ({
                ...prev,
                progress: progress || prev.progress,
                status: data.status || "Downloading...",
                totalSize: data.total,
                completedSize: data.completed
            }));

        } catch (e) {
            console.error("WS Parse error", e);
        }
    };

    ws.onerror = (e) => {
        console.error("WS Error", e);
        setState(prev => ({ ...prev, isDownloading: false, status: "Error" }));
        toast({ title: "Connection Error", description: "WebSocket connection failed", variant: "destructive" });
    };

    ws.onclose = () => {
        if (state.progress < 100 && state.isDownloading) {
             // If closed unexpectedly
             setState(prev => ({ ...prev, isDownloading: false }));
        }
    };
  };

  const cancelDownload = () => {
    // Implement cancellation logic if needed (requires backend support)
    // For now, just reset UI
    setState({
        modelName: null,
        progress: 0,
        status: "",
        isDownloading: false,
    });
  };

  return (
    <DownloadContext.Provider value={{ ...state, startDownload, cancelDownload }}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload() {
  const context = useContext(DownloadContext);
  if (context === undefined) {
    throw new Error("useDownload must be used within a DownloadProvider");
  }
  return context;
}
