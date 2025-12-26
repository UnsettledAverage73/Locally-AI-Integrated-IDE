import React, { useEffect, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Command, Settings, Files, GitBranch } from "lucide-react";
import FileTree from "@/components/FileExplorer/FileTree";
import CodeEditor from "@/components/Editor/CodeEditor";
import EditorTabs from "@/components/Editor/EditorTabs";
import ChatPanel from "@/components/AI/ChatPanel";
import Terminal from "@/components/Terminal/Terminal";
import SettingsModal from "@/components/Settings/SettingsModal";
import SourceControl from "@/components/Git/SourceControl";
import { Button } from "@/components/ui/button";
import { fs, rag, llm, git } from "@/api/client";
import { FileEntry, ChatMessage } from "@/types";
import { cn } from "@/lib/utils";
import { DownloadProvider } from "@/context/DownloadContext";
import { DownloadWidget } from "@/components/DownloadWidget";

interface OpenFile {
  path: string;
  content: string;
}

function App() {
  const { toast } = useToast();
  
  // State
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeView, setActiveView] = useState<'explorer' | 'git'>('explorer');
  const [currentBranch, setCurrentBranch] = useState("..."); // State for branch name
  
  // Loading States
  const [isBooting, setIsBooting] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [hasCheckedOllama, setHasCheckedOllama] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const activeFileContent = openFiles.find((f) => f.path === activeFile)?.content || "";

  // Initial Boot
  useEffect(() => {
    const boot = async () => {
      try {
        // Check Ollama connection
        const ollamaStatus = await llm.check();
        setOllamaAvailable(ollamaStatus.available);
        setHasCheckedOllama(true);

        // Load Theme
        const savedTheme = localStorage.getItem("ui_theme") || "default";
        document.documentElement.className = savedTheme === "default" ? "" : savedTheme;

        // Fetch Ollama models
        if (ollamaStatus.available) {
          const { models } = await llm.models();
          setOllamaModels(models);
        }

        // Fetch File Tree
        const { entries } = await fs.readDirectory("./");
        setFileTree(entries);

        // Fetch Git Branch
        try {
            const { branch } = await git.getBranch();
            setCurrentBranch(branch);
        } catch (e) {
            setCurrentBranch("offline");
        }

        setIsBooting(false);
      } catch (error) {
        toast({
          title: "Connection Failed",
          description: "Could not connect to local filesystem.",
          variant: "destructive",
        });
        setIsBooting(false);
      }
    };
    boot();
  }, []);

  const handleFileClick = async (path: string) => {
    // Check if file is already open
    const existingFile = openFiles.find((f) => f.path === path);
    if (existingFile) {
      setActiveFile(path);
      return;
    }

    try {
      const { content } = await fs.readFile(path);
      setOpenFiles((prev) => [...prev, { path, content }]);
      setActiveFile(path);
    } catch (error) {
      toast({
        title: "Error reading file",
        description: "Could not load file content.",
        variant: "destructive",
      });
    }
  };

  const handleTabClose = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setOpenFiles((prev) => {
      const newFiles = prev.filter((f) => f.path !== path);
      
      // If we closed the active file, switch to another one
      if (activeFile === path) {
        if (newFiles.length > 0) {
          // Switch to the last opened file or the previous one
          const index = prev.findIndex((f) => f.path === path);
          const newActive = newFiles[Math.max(0, index - 1)];
          setActiveFile(newActive.path);
        } else {
          setActiveFile(null);
        }
      }
      
      return newFiles;
    });
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined || !activeFile) return;
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === activeFile ? { ...f, content: value } : f))
    );
  };

  const handleSave = async () => {
    if (!activeFile) return;
    try {
      await fs.writeFile(activeFile, activeFileContent);
      toast({
        title: "File Saved",
        description: `Successfully saved ${activeFile}`,
        className: "bg-green-500/10 border-green-500/50 text-green-500",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Could not write to disk.",
        variant: "destructive",
      });
    }
  };

  const handleIndex = async () => {
    if (!activeFile) return;
    setIsIndexing(true);
    try {
      await rag.indexFile(activeFile, activeFileContent);
      toast({
        title: "Context Updated",
        description: "File successfully indexed by RAG.",
        className: "bg-accent/10 border-accent/50 text-accent",
      });
    } catch (error) {
      toast({
        title: "Indexing Failed",
        variant: "destructive",
      });
    } finally {
      setIsIndexing(false);
    }
  };

  const handleApplyCode = async (code: string) => {
    if (!activeFile) {
        toast({
            title: "No File Selected",
            description: "Please open a file to apply code.",
            variant: "destructive",
        });
        return;
    }

    try {
        await fs.writeFile(activeFile, code);
        // Update openFiles state
        setOpenFiles((prev) =>
            prev.map((f) => (f.path === activeFile ? { ...f, content: code } : f))
        );
        toast({
            title: "Code Applied",
            description: `Updated ${activeFile} successfully.`,
            className: "bg-green-500/10 border-green-500/50 text-green-500",
        });
    } catch (error) {
        toast({
            title: "Apply Failed",
            description: "Could not write to file.",
            variant: "destructive",
        });
    }
  };

  const handleSendMessage = async (content: string) => {
    const newMessages: ChatMessage[] = [
        ...chatMessages, 
        { role: "user", content }
    ];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    try {
      // Add context if file is open and Ollama is available
      let context = "";
      if (activeFile && ollamaAvailable) {
        const { context: ragContext } = await rag.getContext(content, activeFile);
        context = ragContext;
      }

      const messagesToSend = context 
        ? [{ role: "system" as const, content: `Context: ${context}` }, ...newMessages]
        : newMessages;

      const response = await llm.chat(messagesToSend);
      
      setChatMessages(prev => [
        ...prev,
        { role: "assistant", content: response.content }
      ]);
    } catch (error) {
      toast({
        title: "AI Error",
        description: "Could not reach Ollama.",
        variant: "destructive",
      });
    } finally {
      setIsChatLoading(false);
    }  
  };

  if (isBooting) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-primary">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="font-mono animate-pulse">INITIALIZING LOCALDEV ENV...</p>
      </div>
    );
  }

  return (
    <DownloadProvider>
      <div className="h-screen w-screen bg-background text-foreground overflow-hidden flex flex-col">
         {/* Top Bar */}
         <header className="h-10 border-b border-border bg-card/50 backdrop-blur flex items-center px-4 justify-between select-none">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
              <span className="ml-4 font-display font-bold text-lg tracking-widest text-foreground/80">LOCALDEV</span>
            </div>
            <div className="flex items-center gap-2">
               <Button variant="ghost" size="icon" onClick={() => setIsSettingsOpen(true)} className="h-8 w-8 hover:bg-muted">
                  <Settings className="w-4 h-4 text-muted-foreground" />
               </Button>
               <div className="flex items-center text-xs text-muted-foreground font-mono bg-black/20 px-2 py-1 rounded">
                  <Command className="w-3 h-3 mr-2" />
                  v1.0.0-alpha
               </div>
            </div>
         </header>

         {/* Main Layout */}
         <div className="flex-1 overflow-hidden flex">
          {/* Activity Bar (Leftmost Strip) */}
          <div className="w-12 bg-card/30 border-r border-border flex flex-col items-center py-2 space-y-2">
              <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-10 w-10", activeView === 'explorer' ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
                  onClick={() => setActiveView('explorer')}
                  title="File Explorer"
              >
                  <Files className="w-5 h-5" />
              </Button>
              <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-10 w-10", activeView === 'git' ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
                  onClick={() => setActiveView('git')}
                  title="Source Control"
              >
                  <GitBranch className="w-5 h-5" />
              </Button>
          </div>

          <ResizablePanelGroup direction="horizontal">
              {/* Left Sidebar: File Explorer OR Git */}
              <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-card/20 backdrop-blur-sm border-r border-border">
                  {activeView === 'explorer' ? (
                      <div className="h-full flex flex-col">
                          <div className="p-2 text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                              Explorer
                          </div>
                          <div className="flex-1 overflow-y-auto p-2">
                              <FileTree 
                                  entries={fileTree} 
                                  onFileClick={handleFileClick} 
                                  activeFile={activeFile} 
                              />
                          </div>
                      </div>
                  ) : (
                      <SourceControl />
                  )}
              </ResizablePanel>
              
              <ResizableHandle className="bg-border hover:bg-primary transition-colors" />

              {/* Center: Editor & Terminal */}
              <ResizablePanel defaultSize={55} minSize={30}>
                  <ResizablePanelGroup direction="vertical">
                      <ResizablePanel defaultSize={75} minSize={20}>
                          <div className="h-full flex flex-col">
                            {openFiles.length > 0 ? (
                                <>
                                    <EditorTabs 
                                        files={openFiles.map(f => f.path)} 
                                        activeFile={activeFile} 
                                        onTabClick={(path) => setActiveFile(path)} 
                                        onTabClose={handleTabClose} 
                                    />
                                    <div className="flex-1 overflow-hidden">
                                        <CodeEditor 
                                            content={activeFileContent} 
                                            filePath={activeFile} 
                                            onChange={handleEditorChange}
                                            onSave={handleSave}
                                            onIndex={handleIndex}
                                            isIndexing={isIndexing}
                                        />
                                    </div>
                                </>
                            ) : (
                                <CodeEditor 
                                    content="" 
                                    filePath={null} 
                                    onChange={() => {}}
                                    onSave={() => {}}
                                    onIndex={() => {}}
                                    isIndexing={false}
                                />
                            )}
                          </div>
                      </ResizablePanel>
                      
                      <ResizableHandle className="bg-border hover:bg-primary transition-colors" />
                      
                      <ResizablePanel defaultSize={25} minSize={10}>
                          <Terminal />
                      </ResizablePanel>
                  </ResizablePanelGroup>
              </ResizablePanel>

              <ResizableHandle className="bg-border hover:bg-accent transition-colors" />

              {/* Right Sidebar: AI Chat */}
              <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
                  <ChatPanel 
                      messages={chatMessages} 
                      onSendMessage={handleSendMessage} 
                      isLoading={isChatLoading}
                      activeFile={activeFile}
                      ollamaAvailable={ollamaAvailable}
                      ollamaModels={ollamaModels}
                      onClearChat={() => setChatMessages([])}
                      hasCheckedOllama={hasCheckedOllama}
                      onApplyCode={handleApplyCode}
                  />
              </ResizablePanel>
          </ResizablePanelGroup>
         </div>
         
         {/* Status Bar */}
         <footer className="h-6 border-t border-border bg-card text-xs flex items-center px-4 justify-between text-muted-foreground font-mono">
             <div className="flex space-x-4">
                <span>Branch: <span className="text-primary">{currentBranch}</span></span>
                <span>Errors: 0</span>
             </div>
             <div>
                {activeFile ? "UTF-8" : "No File"}
             </div>
         </footer>

         <Toaster />
         <DownloadWidget />
         <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </div>
    </DownloadProvider>
  );
}

export default App;