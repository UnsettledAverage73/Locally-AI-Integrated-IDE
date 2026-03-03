import { create } from 'zustand';
import { fs, rag } from '@/api/client';
import { FileEntry } from '@/types';
import { toast } from '@/hooks/use-toast';

interface OpenFile {
  path: string;
  content: string;
}

interface FileState {
  rootPath: string;
  fileTree: FileEntry[];
  openFiles: OpenFile[];
  activeFile: string | null;
  isIndexing: boolean;

  // Actions
  setRootPath: (path: string) => void;
  setFileTree: (tree: FileEntry[]) => void;
  setActiveFile: (path: string | null) => void;
  
  // Async Actions
  fetchFileTree: () => Promise<void>;
  openFolder: () => Promise<void>;
  openFilesDialog: () => Promise<void>;
  handleFileClick: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  saveFile: (path: string, content: string) => Promise<void>;
}

export const useFileStore = create<FileState>((set, get) => ({
  rootPath: localStorage.getItem("rootPath") || ".",
  fileTree: [],
  openFiles: [],
  activeFile: null,
  isIndexing: false,

  setRootPath: (path: string) => {
    localStorage.setItem("rootPath", path);
    set({ rootPath: path });
    get().fetchFileTree();
  },

  setFileTree: (tree) => set({ fileTree: tree }),
  
  setActiveFile: (path) => set({ activeFile: path }),

  fetchFileTree: async () => {
    try {
      const { rootPath } = get();
      const entries = await fs.getFileTree(rootPath);
      set({ fileTree: entries });
    } catch (error) {
      console.error("Failed to fetch file tree", error);
    }
  },

  openFolder: async () => {
    try {
      const selectedPath = await (window as any).fileSystem?.selectFolder();
      if (selectedPath) {
        get().setRootPath(selectedPath);
        toast({ title: "Folder Opened", description: `Switched to ${selectedPath}` });
      }
    } catch (e) {
      toast({ title: "Error", description: "Could not open folder dialog.", variant: "destructive" });
    }
  },

  openFilesDialog: async () => {
    try {
      const filePaths = await (window as any).fileSystem?.selectFiles();
      if (filePaths && filePaths.length > 0) {
        for (const path of filePaths) {
          await get().handleFileClick(path);
        }
      }
    } catch (e) {
      toast({ title: "Error", description: "Could not open file dialog.", variant: "destructive" });
    }
  },

  handleFileClick: async (path: string) => {
    const { openFiles } = get();
    const existingFile = openFiles.find(f => f.path === path);

    if (existingFile) {
      set({ activeFile: path });
    } else {
      try {
        const { content } = await fs.readFile(path);
        set({
          openFiles: [...openFiles, { path, content }],
          activeFile: path
        });
        
        // Auto-index on open
        rag.indexFile(path, content).catch(err => console.error("Auto-index failed", err));
      } catch (e) {
        toast({ title: "Error", description: `Could not read file: ${path}`, variant: "destructive" });
      }
    }
  },

  closeFile: (path: string) => {
    const { openFiles, activeFile } = get();
    const newFiles = openFiles.filter(f => f.path !== path);
    let nextActive = activeFile;
    
    if (activeFile === path) {
      nextActive = newFiles.length > 0 ? newFiles[newFiles.length - 1].path : null;
    }
    
    set({ openFiles: newFiles, activeFile: nextActive });
  },

  saveFile: async (path: string, content: string) => {
    try {
        await fs.writeFile(path, content);
        const { openFiles } = get();
        set({
            openFiles: openFiles.map(f => f.path === path ? { ...f, content } : f)
        });
        // Re-index on save
        rag.indexFile(path, content).catch(err => console.error("Re-index failed", err));
    } catch (e) {
        toast({ title: "Save Failed", description: String(e), variant: "destructive" });
    }
  }
}));
