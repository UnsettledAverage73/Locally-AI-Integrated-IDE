import React, { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { clsx } from 'clsx';
import { FileEntry } from "@/types";

interface FileTreeNodeProps {
  node: FileEntry;
  level?: number;
  onSelect: (path: string) => void;
  activePath?: string | null;
}

export const FileTreeNode: React.FC<FileTreeNodeProps> = ({ 
  node, 
  level = 0, 
  onSelect, 
  activePath 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Indentation math: 12px per level
  const paddingLeft = `${level * 12 + 12}px`;
  const isSelected = activePath === node.path;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.isDirectory) {
      setIsOpen(!isOpen);
    } else {
      onSelect(node.path);
    }
  };

  return (
    <div className="select-none text-sm text-muted-foreground/80">
      {/* The File/Folder Row */}
      <div 
        className={clsx(
          "flex items-center py-1 cursor-pointer transition-colors border-l-2 border-transparent",
          isSelected 
            ? "bg-accent/20 border-primary text-accent-foreground" 
            : "hover:bg-accent/10 hover:text-foreground"
        )}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {/* Icon Logic */}
        <span className="mr-2 opacity-70">
          {node.isDirectory ? (
             isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : (
             <span className="w-[14px]" /> // Spacer for alignment
          )}
        </span>

        <span className="mr-2 text-primary/80">
          {node.isDirectory ? (
             isOpen ? <FolderOpen size={16} /> : <Folder size={16} />
          ) : (
             <File size={16} className="text-muted-foreground" />
          )}
        </span>

        <span className="truncate">{node.name}</span>
      </div>

      {/* The Recursive Render */}
      {isOpen && node.children && (
        <div className="border-l border-border/50 ml-3"> 
          {node.children.map((child) => (
            <FileTreeNode 
              key={child.path} 
              node={child} 
              level={level + 1} 
              onSelect={onSelect}
              activePath={activePath}
            />
          ))}
        </div>
      )}
    </div>
  );
};
