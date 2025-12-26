import React from "react";
import { X, File, FileCode, FileJson, FileType } from "lucide-react";
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
    if (path.endsWith(".tsx") || path.endsWith(".ts") || path.endsWith(".js") || path.endsWith(".jsx")) {
      return <FileCode className="w-3.5 h-3.5 text-blue-400" />;
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
    return path.split("/").pop() || path;
  };

  return (
    <div className="flex items-center bg-[#1e1e1e] border-b border-black/20 overflow-x-auto no-scrollbar">
      {files.map((file) => (
        <div
          key={file}
          onClick={() => onTabClick(file)}
          className={cn(
            "group flex items-center h-9 px-3 min-w-[120px] max-w-[200px] border-r border-border/10 cursor-pointer select-none text-xs transition-colors",
            activeFile === file
              ? "bg-[#1e1e1e] text-foreground border-t-2 border-t-primary"
              : "bg-[#2d2d2d] text-muted-foreground hover:bg-[#2a2a2a] border-t-2 border-t-transparent"
          )}
        >
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
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
