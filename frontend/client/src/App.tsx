import React, { useEffect, useState, useRef } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Command, Settings, Files, GitBranch, HeartPulse, FolderOpen, Folder, FilePlus } from "lucide-react";
import FileTree from "@/components/FileExplorer/FileTree";
import CodeEditor from "@/components/Editor/CodeEditor";
import Welcome from "@/components/Editor/Welcome";
import EditorTabs from "@/components/Editor/EditorTabs";
import ChatPanel from "@/components/AI/ChatPanel";
import Terminal from "@/components/Terminal/Terminal";
import SettingsModal from "@/components/Settings/SettingsModal";
import SourceControl from "@/components/Git/SourceControl";
import SystemHealth from "@/components/SystemHealth/SystemHealth";
import BootScreen from "@/components/SystemHealth/BootScreen";
import { Button } from "@/components/ui/button";
import { fs, rag, llm, git } from "@/api/client";
import { FileEntry, ChatMessage, ToolCall } from "@/types";
import { cn } from "@/lib/utils";
import { DownloadProvider } from "@/context/DownloadContext";
import { DownloadWidget } from "@/components/DownloadWidget";
import { motion } from "framer-motion";
import Header from "@/components/Layout/Header";
import StatusBar from "@/components/Layout/StatusBar";

interface OpenFile {
  path: string;
  content: string;
}

function App() {
  const { toast } = useToast();
  
  // State
  const [rootPath, setRootPath] = useState<string>(localStorage.getItem("rootPath") || ".");
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeView, setActiveView] = useState<'explorer' | 'git' | 'system'>('explorer');
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
  const chatSocket = useRef<WebSocket | null>(null);

  // WebSocket Chat Connection
  useEffect(() => {
    const connectChatSocket = () => {
      if (chatSocket.current && chatSocket.current.readyState === WebSocket.OPEN) {
        return;
      }

      const ws = new WebSocket("ws://127.0.0.1:8000/ws/ollama/chat_v2");
      chatSocket.current = ws;

      ws.onopen = () => {
        console.log("Connected to Chat WebSocket");
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        switch (data.type) {
          case "content_delta":
            setChatMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                return [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + data.content }];
              }
              return [...prev, { role: 'assistant', content: data.content }];
            });
            break;

          case "tool_calls":
            setChatMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                 // Append tool call permission request
                 return [...prev, { role: 'system', type: 'permission_request', content: 'Tool execution required', tool_calls: data.tool_calls }];
              }
              // This case should ideally not happen if content_delta comes first
              return [...prev, { role: 'assistant', content: '', tool_calls: data.tool_calls }];
            });
            setIsChatLoading(false);
            break;
            
          case "complete":
            setIsChatLoading(false);
            break;
            
          case "error":
            toast({
              title: "AI Stream Error",
              description: data.error,
              variant: "destructive",
            });
            setIsChatLoading(false);
            break;
        }
      };

      ws.onclose = () => {
        console.log("Chat WebSocket disconnected. Reconnecting...");
        setTimeout(connectChatSocket, 1000); // Reconnect after 1 second
      };

      ws.onerror = (err) => {
        console.error("Chat WebSocket error:", err);
        ws.close();
      };
    };

    connectChatSocket();

    return () => {
      chatSocket.current?.close();
    };
  }, []);

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
        const entries = await fs.getFileTree(rootPath);
        setFileTree(entries);

        // Update Watcher
        await fs.watchDirectory(rootPath);

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
  }, [rootPath]);

  const handleOpenFolder = async () => {
    try {
        const selectedPath = await (window as any).fileSystem?.selectFolder();
        if (selectedPath) {
            setRootPath(selectedPath);
            localStorage.setItem("rootPath", selectedPath);
            toast({
                title: "Folder Opened",
                description: `Switched to ${selectedPath}`,
            });
        }
    } catch (e) {
        toast({
            title: "Error",
            description: "Could not open folder dialog.",
            variant: "destructive",
        });
    }
  };

  const handleOpenFiles = async () => {
    try {
        const filePaths = await (window as any).fileSystem?.selectFiles();
        if (filePaths && filePaths.length > 0) {
            for (const path of filePaths) {
                await handleFileClick(path);
            }
        }
    } catch (e) {
        toast({
            title: "Error",
            description: "Could not open file dialog.",
            variant: "destructive",
        });
    }
  };

  // File Watcher (WebSocket)
  useEffect(() => {
      const ws = new WebSocket("ws://127.0.0.1:8000/ws/files");

      ws.onopen = () => {
          console.log("Connected to File Watcher");
      };

      ws.onmessage = async (event) => {
          try {
              const data = JSON.parse(event.data);
              if (data.type === "file_change") {
                  // Refresh tree on structural changes
                  if (['created', 'deleted', 'moved'].includes(data.event)) {
                      const entries = await fs.getFileTree(rootPath);
                      setFileTree(entries);
                  }

                  // Toast for external modifications
                  if (data.event === 'modified' || data.event === 'created') {
                      toast({
                          title: `File ${data.event === 'created' ? 'Created' : 'Changed'}`,
                          description: `External change: ${data.name}`,
                          action: (
                              <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={async () => {
                                      // Reload the file content if it matches active path
                                      try {
                                          if (data.path) {
                                              const { content } = await fs.readFile(data.path);
                                              setOpenFiles((prev) => 
                                                  prev.map((f) => (f.path === data.path ? { ...f, content } : f))
                                              );
                                              // Also update active file content if it is the one open
                                              toast({ title: "File Reloaded" });
                                          }
                                      } catch (e) {
                                          toast({ title: "Reload Failed", variant: "destructive" });
                                      }
                                  }}
                              >
                                  Reload
                              </Button>
                          ),
                      });
                  }
              }
          } catch (e) {
              console.error("WS Error", e);
          }
      };

      return () => {
          ws.close();
      };
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
    if (!chatSocket.current || chatSocket.current.readyState !== WebSocket.OPEN) {
        toast({ title: "AI not connected", description: "Chat service is not available.", variant: "destructive" });
        return;
    }

    const userMessage: ChatMessage = { role: "user", content };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    try {
        let context = "";
        if (activeFile && ollamaAvailable) {
            const { context: ragContext } = await rag.getContext(content, activeFile);
            context = ragContext;
        }

        const messagesToSend = context
            ? [{ role: "system" as const, content: `Context: ${context}` }, ...newMessages]
            : newMessages;
        
        const model = localStorage.getItem("ai_model") || "deepseek-coder";
        const temp = parseFloat(localStorage.getItem("ai_temperature") || "0.4");

        chatSocket.current.send(JSON.stringify({
            type: "chat",
            model,
            messages: messagesToSend,
            options: { temperature: temp }
        }));
    } catch (error) {
        toast({
            title: "AI Error",
            description: "Could not send message to Ollama.",
            variant: "destructive",
        });
        setIsChatLoading(false);
    }
  };

  const handleToolAction = async (toolCall: ToolCall, approved: boolean) => {
      if (!chatSocket.current || chatSocket.current.readyState !== WebSocket.OPEN) {
          toast({ title: "AI not connected", description: "Cannot execute tool action.", variant: "destructive" });
          return;
      }
      setIsChatLoading(true);

      // Remove the permission request message
      setChatMessages(prev => prev.filter(msg => msg.type !== 'permission_request'));

      const model = localStorage.getItem("ai_model") || "deepseek-coder";
      const temp = parseFloat(localStorage.getItem("ai_temperature") || "0.4");

      chatSocket.current.send(JSON.stringify({
          type: "tool_exec",
          model,
          messages: chatMessages,
          tool_call: toolCall,
          approved,
          options: { temperature: temp }
      }));
  };

  if (isBooting) {
    return <BootScreen />;
  }

  return (
    <DownloadProvider>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="h-screen w-screen bg-background text-foreground overflow-hidden flex flex-col"
      >
         <Header onSettingsClick={() => setIsSettingsOpen(true)} />

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
              <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-10 w-10", activeView === 'system' ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
                  onClick={() => setActiveView('system')}
                  title="System Health"
              >
                  <HeartPulse className="w-5 h-5" />
              </Button>
          </div>

          <ResizablePanelGroup direction="horizontal">
              {/* Left Sidebar: File Explorer OR Git */}
              <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-card/20 backdrop-blur-sm border-r border-border">
                  {activeView === 'explorer' && (
                      <div className="h-full flex flex-col">
                          <div className="p-2 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50">
                              <span>Explorer</span>
                              <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted" onClick={handleOpenFiles} title="Open Files">
                                      <FilePlus className="w-3 h-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted" onClick={handleOpenFolder} title="Open Folder">
                                      <FolderOpen className="w-3 h-3" />
                                  </Button>
                              </div>
                          </div>
                          <div className="flex-1 overflow-y-auto p-2">
                              {fileTree.length > 0 ? (
                                <FileTree 
                                    entries={fileTree} 
                                    onFileClick={handleFileClick} 
                                    activeFile={activeFile} 
                                />
                              ) : (
                                <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                                    <Folder className="w-8 h-8 mb-2 opacity-20" />
                                    <p className="text-xs text-muted-foreground mb-4">No folder opened</p>
                                    <Button variant="outline" size="sm" onClick={handleOpenFolder} className="text-xs">
                                        Open Folder
                                    </Button>
                                </div>
                              )}
                          </div>
                      </div>
                  )}
                  {activeView === 'git' && <SourceControl />}
                  {activeView === 'system' && <SystemHealth />}
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
                                <Welcome onOpenFolder={handleOpenFolder} onOpenFile={handleOpenFiles} />
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
                      onToolAction={handleToolAction}
                  />
              </ResizablePanel>
          </ResizablePanelGroup>
         </div>
         
         {/* Status Bar */}
         <StatusBar currentBranch={currentBranch} activeFile={activeFile} />

         <Toaster />
         <DownloadWidget />
         <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      </motion.div>
    </DownloadProvider>
  );
}

export default App;