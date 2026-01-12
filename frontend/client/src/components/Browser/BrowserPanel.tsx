import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, RotateCcw, ChevronLeft, ChevronRight, Globe, ExternalLink } from "lucide-react";

export default function BrowserPanel() {
  const [url, setUrl] = useState("https://www.google.com");
  const [inputUrl, setInputUrl] = useState("https://www.google.com");

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl.trim();
    
    // Check if it's a local file URL or absolute path
    if (target.startsWith("file://") || target.startsWith("/") || (target.length > 3 && target[1] === ":" && target[2] === "\\")) {
      // Use the backend preview proxy
      const cleanPath = target.startsWith("file://") ? target.slice(7) : target;
      target = `http://127.0.0.1:8000/preview/${encodeURIComponent(cleanPath)}`;
    } else if (!target.startsWith("http") && !target.includes(".")) {
      // It's a search query
      target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
    } else if (!target.startsWith("http")) {
      // Assume missing protocol
      target = `https://${target}`;
    }
    
    setUrl(target);
    setInputUrl(target.includes("/preview/") ? `file://${decodeURIComponent(target.split("/preview/")[1])}` : target);
  };

  const reload = () => {
    const current = url;
    setUrl("");
    setTimeout(() => setUrl(current), 10);
  };

  return (
    <div className="h-full flex flex-col bg-background/50 backdrop-blur-sm">
      <div className="p-2 border-b border-border/50 bg-card/30 space-y-2">
        <div className="flex items-center gap-1">
          <div className="flex items-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
            <Globe className="w-3 h-3 mr-1.5 text-accent" />
            Browser
          </div>
        </div>
        
        <form onSubmit={handleNavigate} className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-50" disabled>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-50" disabled>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={reload} type="button">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
          
          <div className="flex-1 relative group">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground group-focus-within:text-accent transition-colors" />
            <Input 
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="h-7 pl-8 pr-8 text-xs bg-black/20 border-border/40 focus-visible:ring-1 focus-visible:ring-accent/50"
              placeholder="Search or enter URL..."
            />
            <a 
              href={url} 
              target="_blank" 
              rel="noreferrer"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-accent transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </form>
      </div>

      <div className="flex-1 relative bg-white/5 overflow-hidden">
        {url ? (
          <iframe 
            src={url} 
            className="w-full h-full border-none"
            title="IDE Browser"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs animate-pulse">
            Loading...
          </div>
        )}
        
        {/* Overlay for sites that block iframes (common) */}
        <div className="absolute bottom-4 right-4 max-w-[200px]">
            <div className="p-3 bg-card border border-border rounded-lg shadow-xl text-[10px] space-y-2">
                <p className="opacity-70 leading-relaxed">Some sites may block embedded viewing for security.</p>
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full h-6 text-[9px] gap-1"
                    onClick={() => window.open(url, '_blank')}
                >
                    <ExternalLink className="w-2.5 h-2.5" />
                    Open Externally
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
}
