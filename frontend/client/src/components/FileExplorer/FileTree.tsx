import React, { useState } from "react";
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from "lucide-react";
import { FileEntry } from "../../types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface FileTreeProps {
  entries: FileEntry[];
  onFileClick: (path: string) => void;
  activeFile: string | null;
  level?: number;
}

const FileTreeNode: React.FC<{
  entry: FileEntry;
  onFileClick: (path: string) => void;
  activeFile: string | null;
  level: number;
}> = ({ entry, onFileClick, activeFile, level }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = () => setIsOpen(!isOpen);

  const isSelected = activeFile === entry.path;

  return (
    <div>
      <div
        className={cn(
          "flex items-center py-1 px-2 cursor-pointer select-none text-sm transition-colors duration-150 group",
          isSelected ? "bg-accent/20 text-accent" : "hover:bg-accent/10 text-muted-foreground hover:text-foreground"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
        onClick={() => {
          if (entry.isDirectory) {
            toggleOpen();
          } else {
            onFileClick(entry.path);
          }
        }}
      >
        <span className="mr-1.5 opacity-70 group-hover:opacity-100 transition-opacity">
          {entry.isDirectory ? (
            isOpen ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )
          ) : (
            <span className="w-4 h-4 block" /> 
          )}
        </span>
        
        <span className="mr-2 text-primary/80">
          {entry.isDirectory ? (
            isOpen ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
          ) : (
            <File className="w-4 h-4" />
          )}
        </span>
        
        <span className="truncate">{entry.name}</span>
      </div>

      <AnimatePresence>
        {entry.isDirectory && isOpen && entry.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <FileTree 
                entries={entry.children} 
                onFileClick={onFileClick} 
                activeFile={activeFile} 
                level={level + 1} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function FileTree({ entries, onFileClick, activeFile, level = 0 }: FileTreeProps) {
  return (
    <div className="w-full">
      {entries.map((entry) => (
        <FileTreeNode
          key={entry.path}
          entry={entry}
          onFileClick={onFileClick}
          activeFile={activeFile}
          level={level}
        />
      ))}
    </div>
  );
}
