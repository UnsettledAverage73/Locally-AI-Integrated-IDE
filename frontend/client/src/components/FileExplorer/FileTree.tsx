import React from "react";
import { FileEntry } from "../../types";
import { FileTreeNode } from "./FileTreeNode";

interface FileTreeProps {
  entries: FileEntry[];
  onFileClick: (path: string) => void;
  activeFile: string | null;
  level?: number;
}

export default function FileTree({ entries, onFileClick, activeFile, level = 0 }: FileTreeProps) {
  return (
    <div className="w-full">
      {entries.map((entry) => (
        <FileTreeNode
          key={entry.path}
          node={entry}
          onSelect={onFileClick}
          activePath={activeFile}
          level={level}
        />
      ))}
    </div>
  );
}
