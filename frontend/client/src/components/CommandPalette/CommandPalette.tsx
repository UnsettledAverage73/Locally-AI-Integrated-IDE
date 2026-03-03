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
  LayoutGrid,
  Columns,
  Palette,
  Files,
  GitBranch,
  HeartPulse,
  Monitor
} from "lucide-react";

interface CommandPaletteProps {
  onOpenFiles: () => void;
  onOpenFolder: () => void;
  onOpenSettings: () => void;
  onToggleTerminal: () => void;
  onOpenSearch: () => void;
  onOpenFileManager: () => void;
  onToggleSidebar: () => void;
  onSwitchTheme: (theme: string) => void;
  onOpenView: (view: 'explorer' | 'search' | 'git' | 'system') => void;
}

export function CommandPalette({
  onOpenFiles,
  onOpenFolder,
  onOpenSettings,
  onToggleTerminal,
  onOpenSearch,
  onOpenFileManager,
  onToggleSidebar,
  onSwitchTheme,
  onOpenView
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // VS Code uses Ctrl+Shift+P for Command Palette, Ctrl+P for File Search.
      // We use Ctrl+P for Command Palette for now as it's common.
      if ((e.key === "p" || e.key === "P") && (e.metaKey || e.ctrlKey)) {
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
        <CommandGroup heading="View Management">
          <CommandItem onSelect={() => { onToggleSidebar(); setOpen(false); }}>
            <Columns className="mr-2 h-4 w-4" />
            <span>Toggle Sidebar Visibility</span>
          </CommandItem>
          <CommandItem onSelect={() => { onOpenView('explorer'); setOpen(false); }}>
            <Files className="mr-2 h-4 w-4" />
            <span>Focus Explorer</span>
          </CommandItem>
          <CommandItem onSelect={() => { onOpenView('search'); setOpen(false); }}>
            <Search className="mr-2 h-4 w-4" />
            <span>Focus Search</span>
          </CommandItem>
          <CommandItem onSelect={() => { onOpenView('git'); setOpen(false); }}>
            <GitBranch className="mr-2 h-4 w-4" />
            <span>Focus Source Control</span>
          </CommandItem>
          <CommandItem onSelect={() => { onOpenView('system'); setOpen(false); }}>
            <HeartPulse className="mr-2 h-4 w-4" />
            <span>Focus System Health</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Tools & Appearance">
          <CommandItem onSelect={() => { onOpenFileManager(); setOpen(false); }}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            <span>Open File Manager</span>
          </CommandItem>
          <CommandItem onSelect={() => { onToggleTerminal(); setOpen(false); }}>
            <Terminal className="mr-2 h-4 w-4" />
            <span>Toggle Terminal</span>
          </CommandItem>
          <CommandItem onSelect={() => { onSwitchTheme('theme-vscode-dark'); setOpen(false); }}>
            <Palette className="mr-2 h-4 w-4" />
            <span>Switch Theme: VS Code Dark</span>
          </CommandItem>
          <CommandItem onSelect={() => { onSwitchTheme('default'); setOpen(false); }}>
            <Palette className="mr-2 h-4 w-4" />
            <span>Switch Theme: Midnight</span>
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
