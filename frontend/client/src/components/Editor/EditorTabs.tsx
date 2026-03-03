import React from "react";
import { X, File, FileCode, FileJson, FileType, LayoutGrid, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditorTabsProps {
  files: string[];
  activeFile: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string, e: React.MouseEvent) => void;
}

export default function EditorTabs({
  files,
  activeFile,
  onTabClick,
  onTabClose,
}: EditorTabsProps) {
  const getFileIcon = (path: string) => {
    if (path === "system://file-manager") {
      return <LayoutGrid className="w-3.5 h-3.5 text-accent" />;
    }
    if (path === "system://browser") {
      return <Globe className="w-3.5 h-3.5 text-blue-400" />;
    }
    if (path.endsWith(".tsx") || path.endsWith(".ts") || path.endsWith(".js") || path.endsWith(".jsx")) {
      return <FileCode className="w-3.5 h-3.5 text-blue-400" />;
    }
    if (path.endsWith(".py")) {
      return <FileCode className="w-3.5 h-3.5 text-yellow-300" />; // Python
    }
    if (path.endsWith(".json")) {
      return <FileJson className="w-3.5 h-3.5 text-yellow-400" />;
    }
    if (path.endsWith(".css")) {
      return <FileType className="w-3.5 h-3.5 text-sky-300" />;
    }
    return <File className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const getFileName = (path: string) => {
    if (path === "system://file-manager") return "File Manager";
    if (path === "system://browser") return "Browser";
    return path.split("/").pop() || path;
  };

  return (
    <div className="flex items-center bg-card border-b border-border/50 overflow-x-auto no-scrollbar h-9">
      {files.map((file) => (
        <div
          key={file}
          onClick={() => onTabClick(file)}
          className={cn(
            "group flex items-center h-full px-3 min-w-[120px] max-w-[220px] border-r border-border/30 cursor-pointer select-none text-xs transition-all relative",
            activeFile === file
              ? "bg-background text-foreground"
              : "bg-card/50 text-muted-foreground hover:bg-background/50"
          )}
        >
          {activeFile === file && (
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary" />
          )}
          <span className="mr-2 opacity-80">{getFileIcon(file)}</span>
          <span className="truncate flex-1 font-normal">{getFileName(file)}</span>
          <button
            onClick={(e) => {
                e.stopPropagation(); 
                onTabClose(file, e);
            }}
            className={cn(
              "ml-2 p-0.5 rounded-sm hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 transition-opacity",
              activeFile === file && "opacity-100" // Always show close button on active tab
            )}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
