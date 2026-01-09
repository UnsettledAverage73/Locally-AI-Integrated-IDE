import React, { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { 
  FileText, 
  Settings, 
  Terminal, 
  Search, 
  Github, 
  FolderOpen,
  LayoutGrid
} from "lucide-react";

interface CommandPaletteProps {
  onOpenFiles: () => void;
  onOpenFolder: () => void;
  onOpenSettings: () => void;
  onToggleTerminal: () => void;
  onOpenSearch: () => void;
  onOpenFileManager: () => void;
}

export function CommandPalette({
  onOpenFiles,
  onOpenFolder,
  onOpenSettings,
  onToggleTerminal,
  onOpenSearch,
  onOpenFileManager
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "p" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="File Actions">
          <CommandItem onSelect={() => { onOpenFiles(); setOpen(false); }}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Open File</span>
          </CommandItem>
          <CommandItem onSelect={() => { onOpenFolder(); setOpen(false); }}>
            <FolderOpen className="mr-2 h-4 w-4" />
            <span>Open Folder</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tools">
          <CommandItem onSelect={() => { onOpenFileManager(); setOpen(false); }}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            <span>File Manager</span>
          </CommandItem>
          <CommandItem onSelect={() => { onOpenSearch(); setOpen(false); }}>
            <Search className="mr-2 h-4 w-4" />
            <span>Search Files</span>
          </CommandItem>
          <CommandItem onSelect={() => { onToggleTerminal(); setOpen(false); }}>
            <Terminal className="mr-2 h-4 w-4" />
            <span>Toggle Terminal</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => { onOpenSettings(); setOpen(false); }}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Preferences</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
