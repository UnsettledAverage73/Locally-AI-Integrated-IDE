import React, { useEffect, useRef, useState } from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Command, Settings, Files, GitBranch, HeartPulse, FolderOpen, Folder, FilePlus, Search, LayoutGrid, Globe, Blocks, ChevronDown, ChevronRight } from "lucide-react";

import FileTree from "@/components/FileExplorer/FileTree";
import CodeEditor from "@/components/Editor/CodeEditor";
import Welcome from "@/components/Editor/Welcome";
import EditorTabs from "@/components/Editor/EditorTabs";
import ChatPanel from "@/components/AI/ChatPanel";
import TerminalManager from "@/components/Terminal/TerminalManager";
import SettingsModal from "@/components/Settings/SettingsModal";
import SearchPanel from "@/components/Search/SearchPanel";
import FileManager from "@/components/FileManager/FileManager";
import SourceControl from "@/components/Git/SourceControl";
import SystemHealth from "@/components/SystemHealth/SystemHealth";
import BootScreen from "@/components/SystemHealth/BootScreen";
import BrowserPanel from "@/components/Browser/BrowserPanel";
import Header from "@/components/Layout/Header";
import StatusBar from "@/components/Layout/StatusBar";
import { CommandPalette } from "@/components/CommandPalette/CommandPalette";

import { Button } from "@/components/ui/button";
import { llm, apiClient } from "@/api/client";
import { ToolCall } from "@/types";
import { cn } from "@/lib/utils";
import { DownloadProvider } from "@/context/DownloadContext";
import { DownloadWidget } from "@/components/DownloadWidget";
import { motion } from "framer-motion";
import { useSettings } from "@/context/SettingsContext";

// Stores
import { useFileStore } from "./store/useFileStore";
import { useChatStore } from "./store/useChatStore";
import { useUIStore } from "./store/useUIStore";
import { useSystemStore } from "./store/useSystemStore";
import { useTerminalStore } from "./store/useTerminalStore";

// Hooks
import { useChatWebSocket } from "./hooks/useChatWebSocket";
import { useFileWatcher } from "./hooks/useFileWatcher";

export default function App() {
  const { toast } = useToast();
  const { aiMode, enterpriseHost } = useSettings();
  
  // Store States & Actions
  const { rootPath, fileTree, openFiles, activeFile, setActiveFile, handleFileClick, closeFile, saveFile, openFolder, openFilesDialog, fetchFileTree } = useFileStore();
  const { chatMessages, chatSessions, currentSessionId, isChatLoading, fetchChatSessions, selectSession, createNewChat, deleteSession, clearChat } = useChatStore();
  const { activeView, isSidebarVisible, isPanelVisible, isSettingsOpen, isBooting, toggleSidebar, togglePanel, setIsSettingsOpen, setIsBooting, handleViewChange } = useUIStore();
  const { ollamaAvailable, ollamaModels, lspStatus, currentBranch, checkOllama, fetchModels, fetchBranch, setLspStatus } = useSystemStore();
  const { terminalSessions, activeTerminal, setActiveTerminal, createTerminal } = useTerminalStore();

  // Custom Hooks for WebSockets
  const { sendMessage } = useChatWebSocket();
  useFileWatcher();

  const [browserUrl, setBrowserUrl] = useState("https://www.google.com");
  const editorRef = useRef<any>(null);

  // Initial Boot
  useEffect(() => {
    const boot = async (retryCount = 0) => {
      console.log(`🚀 Starting boot process (attempt ${retryCount + 1})...`);
      try {
        // AI Host Init - with internal retry logic for this critical step
        const host = aiMode === "enterprise" && enterpriseHost ? enterpriseHost : 'http://localhost:11434';
        
        try {
            await llm.updateAIHost(host);
        } catch (hostError) {
            console.warn("⚠️ AI Host update failed, retrying...", hostError);
            if (retryCount < 5) {
                setTimeout(() => boot(retryCount + 1), 2000);
                return;
            }
            // If still failing after 5 retries, we continue anyway to allow the UI to load
            console.error("❌ AI Host update failed after 5 retries. Proceeding with limited functionality.");
        }

        await Promise.all([
            checkOllama(),
            fetchChatSessions(),
            fetchFileTree(),
            fetchBranch(),
            createTerminal()
        ]);

        if (currentSessionId) {
            await selectSession(currentSessionId).catch(e => console.error("Failed to select session", e));
        }

        setIsBooting(false);
      } catch (error) {
        console.error("🔥 CRITICAL BOOT ERROR:", error);
        // Even on critical error, don't leave user on boot screen forever
        setIsBooting(false);
        toast({
            title: "Startup Warning",
            description: "Some services failed to start. You can still use the editor, but AI features may be limited.",
            variant: "destructive"
        });
      }
    };
    boot();
  }, [rootPath]);

  // Command handlers
  const onSendMessage = (content: string) => {
    const model = localStorage.getItem("ai_model") || "qwen2.5:0.5b";
    sendMessage(content, model, currentSessionId);
  };

  const handleToolAction = async (toolCall: ToolCall, approved: boolean) => {
    try {
        const res = await llm.executeTool(chatMessages, toolCall, approved);
        useChatStore.setState(state => ({
            chatMessages: [...state.chatMessages, { role: 'assistant', content: res.content }]
        }));
    } catch (e: any) {
        toast({ title: "Tool Execution Failed", description: e.message, variant: "destructive" });
    }
  };

  const handleOpenBrowser = (url?: string) => {
    if (url) setBrowserUrl(url);
    const path = "system://browser";
    if (!openFiles.find(f => f.path === path)) {
        useFileStore.setState(state => ({
            openFiles: [...state.openFiles, { path, content: "" }]
        }));
    }
    setActiveFile(path);
  };

  const handleOpenFileManager = () => {
    const path = "system://file-manager";
    if (!openFiles.find(f => f.path === path)) {
        useFileStore.setState(state => ({
            openFiles: [...state.openFiles, { path, content: "" }]
        }));
    }
    setActiveFile(path);
  };

  if (isBooting) return <BootScreen />;

  return (
    <DownloadProvider>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden font-sans selection:bg-primary/30"
      >
         <Header 
            onToggleSidebar={toggleSidebar} 
            onTogglePanel={togglePanel}
            isSidebarVisible={isSidebarVisible}
            isPanelVisible={isPanelVisible}
            onSettingsClick={() => setIsSettingsOpen(true)}
         />

         <div className="flex-1 flex overflow-hidden">
              <ResizablePanelGroup direction="horizontal" className="flex-1">
              
              {isSidebarVisible && (
                  <>
                      <ResizablePanel defaultSize={20} minSize={15} maxSize={40} className="bg-card/50 backdrop-blur-md border-r border-border/50 flex flex-col shadow-2xl">
                          {/* Sidebar Navigation */}
                          <div className="flex items-center justify-around border-b border-border/30 p-1 bg-muted/20">
                              <Button variant="ghost" size="icon" onClick={() => handleViewChange('explorer')} className={cn("w-8 h-8", activeView === 'explorer' && "bg-accent text-accent-foreground")}>
                                  <Files className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleViewChange('search')} className={cn("w-8 h-8", activeView === 'search' && "bg-accent text-accent-foreground")}>
                                  <Search className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleViewChange('git')} className={cn("w-8 h-8", activeView === 'git' && "bg-accent text-accent-foreground")}>
                                  <GitBranch className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleViewChange('system')} className={cn("w-8 h-8", activeView === 'system' && "bg-accent text-accent-foreground")}>
                                  <HeartPulse className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleViewChange('browser')} className={cn("w-8 h-8", activeView === 'browser' && "bg-accent text-accent-foreground")}>
                                  <Globe className="w-4 h-4" />
                              </Button>
                          </div>

                          {/* View Content */}
                          {activeView === 'explorer' && (
                              <div className="flex-1 flex flex-col overflow-hidden">
                                  <div className="p-3 flex items-center justify-between border-b border-border/20">
                                      <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Explorer</h2>
                                      <div className="flex gap-1">
                                          <Button variant="ghost" size="icon" className="w-6 h-6 rounded" onClick={openFilesDialog} title="Open Files">
                                              <FilePlus className="w-3 h-3" />
                                          </Button>
                                          <Button variant="ghost" size="icon" className="w-6 h-6 rounded" onClick={openFolder} title="Open Folder">
                                              <FolderOpen className="w-3 h-3" />
                                          </Button>
                                      </div>
                                  </div>
                                  
                                  <div className="flex-1 overflow-y-auto no-scrollbar">
                                      {openFiles.length > 0 && (
                                          <div className="mb-2">
                                              <div className="flex items-center px-2 py-1 bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer group">
                                                  <ChevronDown className="w-3 h-3 mr-1" />
                                                  <span>Open Editors</span>
                                              </div>
                                              <div className="mt-1">
                                                  {openFiles.map(file => (
                                                      <div 
                                                        key={file.path}
                                                        onClick={() => setActiveFile(file.path)}
                                                        className={cn(
                                                            "flex items-center px-4 py-1 text-xs cursor-pointer hover:bg-accent/10 transition-colors",
                                                            activeFile === file.path ? "bg-accent/20 text-accent-foreground" : "text-muted-foreground"
                                                        )}
                                                      >
                                                          <span className="truncate">{file.path.split('/').pop()}</span>
                                                      </div>
                                                  ))}
                                              </div>
                                          </div>
                                      )}

                                      <div className="flex items-center px-2 py-1 bg-muted/30 text-[10px] font-bold text-muted-foreground uppercase tracking-widest cursor-pointer">
                                          <ChevronDown className="w-3 h-3 mr-1" />
                                          <span>{rootPath.split('/').pop() || "Project"}</span>
                                      </div>
                                      
                                      <div className="p-2">
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
                                                <Button variant="outline" size="sm" onClick={openFolder} className="text-xs">
                                                    Open Folder
                                                </Button>
                                            </div>
                                          )}
                                      </div>
                                  </div>
                              </div>
                          )}
                          {activeView === 'search' && <SearchPanel onFileClick={handleFileClick} />}
                          {activeView === 'git' && <SourceControl />}
                          {activeView === 'system' && <SystemHealth />}
                          {activeView === 'browser' && <BrowserPanel initialUrl={browserUrl} />}
                      </ResizablePanel>
                      <ResizableHandle className="bg-border/50 hover:bg-primary/50 transition-colors" />
                  </>
              )}

              {/* Center: Editor & Terminal */}
              <ResizablePanel defaultSize={55} minSize={30}>
                  <ResizablePanelGroup direction="vertical">
                      <ResizablePanel defaultSize={75} minSize={20} className="flex flex-col bg-card/20">
                          {openFiles.length > 0 ? (
                              <div className="flex-1 flex flex-col overflow-hidden">
                                  <EditorTabs 
                                    files={openFiles.map(f => f.path)} 
                                    activeFile={activeFile || ""} 
                                    onTabClick={setActiveFile} 
                                    onTabClose={closeFile} 
                                  />
                                  <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
                                      {activeFile === 'system://file-manager' ? <FileManager onFileOpen={handleFileClick} /> :
                                       activeFile === 'system://browser' ? <BrowserPanel initialUrl={browserUrl} /> :
                                       <CodeEditor 
                                          ref={editorRef}
                                          content={openFiles.find(f => f.path === activeFile)?.content || ""} 
                                          filePath={activeFile}
                                          onChange={(val) => {
                                              if (activeFile) {
                                                  useFileStore.setState(state => ({
                                                      openFiles: state.openFiles.map(f => f.path === activeFile ? { ...f, content: val || "" } : f)
                                                  }));
                                              }
                                          }}
                                          onSave={() => activeFile && saveFile(activeFile, openFiles.find(f => f.path === activeFile)?.content || "")}
                                          onIndex={() => {}}
                                          isIndexing={false}
                                          onLspStateChange={setLspStatus}
                                          onRun={(path) => handleOpenBrowser(`file://${path}`)}
                                       />
                                      }
                                  </div>
                              </div>
                          ) : (
                              <Welcome onOpenFolder={openFolder} onOpenFile={openFilesDialog} />
                          )}
                      </ResizablePanel>
                      
                      {isPanelVisible && (
                          <>
                              <ResizableHandle className="bg-border/50 hover:bg-primary/50 transition-colors" />
                              <ResizablePanel defaultSize={25} minSize={10}>
                                  <TerminalManager 
                                    sessions={terminalSessions}
                                    setSessions={(s) => {
                                        if (typeof s === 'function') {
                                            const next = s(terminalSessions);
                                            useTerminalStore.setState({ terminalSessions: next });
                                        } else {
                                            useTerminalStore.setState({ terminalSessions: s || [] });
                                        }
                                    }}
                                    activeTab={activeTerminal}
                                    setActiveTab={(id) => {
                                        if (typeof id === 'function') {
                                            const next = id(activeTerminal);
                                            setActiveTerminal(next);
                                        } else {
                                            setActiveTerminal(id);
                                        }
                                    }}
                                  />
                              </ResizablePanel>
                          </>
                      )}
                  </ResizablePanelGroup>
              </ResizablePanel>

              {/* Right: AI Chat */}
              <ResizableHandle className="bg-border/50 hover:bg-primary/50 transition-colors" />
              <ResizablePanel defaultSize={25} minSize={20} className="bg-card/30 backdrop-blur-xl border-l border-border/50 shadow-2xl">
                  <ChatPanel 
                    messages={chatMessages}
                    onSendMessage={onSendMessage}
                    onCommand={() => {}}
                    onStopGeneration={() => {}}
                    onRemoveContext={() => {}}
                    isLoading={isChatLoading}
                    activeFile={activeFile}
                    ollamaAvailable={ollamaAvailable}
                    ollamaModels={ollamaModels}
                    onClearChat={clearChat}
                    hasCheckedOllama={true}
                    onApplyCode={(code) => editorRef.current?.triggerSmartMerge(code)}
                    onToolAction={handleToolAction}
                    onTerminalCommand={(cmd) => {}}
                    sessions={chatSessions}
                    currentSessionId={currentSessionId}
                    onSelectSession={selectSession}
                    onNewChat={createNewChat}
                    onDeleteSession={deleteSession}
                  />
              </ResizablePanel>

              </ResizablePanelGroup>
         </div>
         
         <StatusBar 
            currentBranch={currentBranch} 
            activeFile={activeFile} 
            isIndexing={false}
            lspStatus={lspStatus}
         />

         <Toaster />
         <DownloadWidget />
         
         <SettingsModal isOpen={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
         
         <CommandPalette 
            isOpen={false} 
            onOpenChange={() => {}}
            onOpenFiles={openFilesDialog}
            onOpenFolder={openFolder}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleTerminal={togglePanel}
            onOpenSearch={() => handleViewChange('search')}
            onOpenFileManager={handleOpenFileManager}
            onToggleSidebar={toggleSidebar}
            onOpenView={handleViewChange}
            onSwitchTheme={(themeId) => {
                localStorage.setItem("ui_theme", themeId);
                document.documentElement.className = themeId === "default" ? "" : themeId;
                toast({ title: "Theme Switched", description: `Active theme: ${themeId}` });
            }}
         />
      </motion.div>
    </DownloadProvider>
  );
}
