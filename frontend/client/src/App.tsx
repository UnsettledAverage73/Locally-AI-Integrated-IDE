import React, { useEffect, useState, useRef } from "react";
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
import { Button } from "@/components/ui/button";
import { fs, rag, llm, git } from "@/api/client";
import { FileEntry, ChatMessage, ToolCall } from "@/types";
import { cn } from "@/lib/utils";
import { DownloadProvider } from "@/context/DownloadContext";
import { DownloadWidget } from "@/components/DownloadWidget";
import { motion } from "framer-motion";
import Header from "@/components/Layout/Header";
import StatusBar from "@/components/Layout/StatusBar";
import { CommandPalette } from "@/components/CommandPalette/CommandPalette";
import { CodeEditorRef } from "@/components/Editor/CodeEditor";
import { apiClient } from "@/api/client";

import { useSettings } from "@/context/SettingsContext";

import { State } from '@/lib/language-client';

interface OpenFile {
  path: string;
  content: string;
}

function App() {
  const { toast } = useToast();
  const { aiMode, enterpriseHost } = useSettings();
  
  // State
  const [rootPath, setRootPath] = useState<string>(localStorage.getItem("rootPath") || ".");
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeView, setActiveView] = useState<'explorer' | 'git' | 'system' | 'search'>('explorer');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [currentBranch, setCurrentBranch] = useState("..."); // State for branch name
  const [lspStatus, setLspStatus] = useState<State>(State.Stopped);
  
  const toggleSidebar = () => setIsSidebarVisible(!isSidebarVisible);
  const togglePanel = () => setIsPanelVisible(!isPanelVisible);

  const handleViewChange = (view: 'explorer' | 'git' | 'system' | 'search') => {
    if (activeView === view && isSidebarVisible) {
        setIsSidebarVisible(false);
    } else {
        setActiveView(view);
        setIsSidebarVisible(true);
    }
  };

  const [terminalSessions, setTerminalSessions] = useState<string[]>([]);
  const [activeTerminal, setActiveTerminal] = useState<string>('');
  
  // Chat History State
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(localStorage.getItem("currentSessionId"));

  useEffect(() => {
    // Create an initial terminal on mount
    if (terminalSessions.length === 0) {
        apiClient.post('/terminals').then(response => {
            const { session_id } = response.data;
            setTerminalSessions([session_id]);
            setActiveTerminal(session_id);
        });
    }
  }, []);

  const fetchChatSessions = async () => {
    try {
      const res = await apiClient.get("/chat/sessions");
      setChatSessions(res.data);
    } catch (e) {
      console.error("Failed to fetch chat sessions", e);
    }
  };

  const handleSelectSession = async (sessionId: string) => {
    try {
      const res = await apiClient.get(`/chat/sessions/${sessionId}`);
      setChatMessages(res.data.messages || []);
      setCurrentSessionId(sessionId);
      localStorage.setItem("currentSessionId", sessionId);
    } catch (e) {
      toast({ title: "Error", description: "Failed to load chat history.", variant: "destructive" });
    }
  };

  const handleNewChat = async () => {
    try {
      const model = localStorage.getItem("ai_model") || "qwen2.5:0.5b";
      const res = await apiClient.post("/chat/sessions", { model });
      const { session_id } = res.data;
      setCurrentSessionId(session_id);
      localStorage.setItem("currentSessionId", session_id);
      setChatMessages([]);
      fetchChatSessions();
    } catch (e) {
      toast({ title: "Error", description: "Failed to create new chat.", variant: "destructive" });
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await apiClient.delete(`/chat/sessions/${sessionId}`);
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        localStorage.removeItem("currentSessionId");
        setChatMessages([]);
      }
      fetchChatSessions();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete chat.", variant: "destructive" });
    }
  };
  
  const handleOpenFileManager = () => {
    const path = "system://file-manager";
    if (!openFiles.find(f => f.path === path)) {
        setOpenFiles(prev => [...prev, { path, content: "" }]);
    }
    setActiveFile(path);
  };

  const handleOpenBrowser = () => {
    const path = "system://browser";
    if (!openFiles.find(f => f.path === path)) {
        setOpenFiles(prev => [...prev, { path, content: "" }]);
    }
    setActiveFile(path);
  };

  const handleRunHtml = (path: string) => {
    const fileUrl = `file://${path}`;
    setBrowserUrl(fileUrl);
    handleOpenBrowser();
  };
  
  // Loading States
  const [isBooting, setIsBooting] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [hasCheckedOllama, setHasCheckedOllama] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [browserUrl, setBrowserUrl] = useState("https://www.google.com");
  const [queuedMessages, setQueuedMessages] = useState<string[]>([]);

  const activeFileContent = openFiles.find((f) => f.path === activeFile)?.content || "";
  const chatSocket = useRef<WebSocket | null>(null);
  const editorRef = useRef<CodeEditorRef>(null);

  const refreshOllamaData = async () => {
    try {
        const host = aiMode === 'enterprise' ? enterpriseHost : 'http://localhost:11434';
        const status = await llm.updateAIHost(host);
        setOllamaAvailable(status.available);
        setHasCheckedOllama(true);
        if (status.available) {
            const { models } = await llm.models();
            setOllamaModels(models);
        } else {
            setOllamaModels([]);
        }
    } catch (e) {
        console.error("Failed to refresh Ollama data", e);
        setOllamaAvailable(false);
        setOllamaModels([]);
    }
  };

  useEffect(() => {
    window.addEventListener('ollamaHostChanged', refreshOllamaData);
    return () => {
      window.removeEventListener('ollamaHostChanged', refreshOllamaData);
    };
  }, [aiMode, enterpriseHost]);

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
            // Trigger Signal for Dashboard
            window.dispatchEvent(new Event("llm-request-completed"));
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
      console.log("🚀 Starting boot process...");
      try {
        // --- ENTERPRISE AUTO-CONNECT ---
        if (aiMode === "enterprise" && enterpriseHost) {
            console.log(`📡 Enterprise Mode: Attempting connection to ${enterpriseHost}`);
            try {
                await llm.updateAIHost(enterpriseHost);
                console.log("✅ AI Host updated.");
            } catch (e) {
                console.error("❌ Failed to update AI Host:", e);
            }
        }

        // Check Ollama connection
        console.log("🔍 Checking Ollama status...");
        const ollamaStatus = await llm.check();
        setOllamaAvailable(ollamaStatus.available);
        setHasCheckedOllama(true);
        console.log(`✅ Ollama available: ${ollamaStatus.available}`);

        // Load Theme
        console.log("🎨 Loading theme...");
        const savedTheme = localStorage.getItem("ui_theme") || "default";
        document.documentElement.className = savedTheme === "default" ? "" : savedTheme;

        // Fetch Ollama models
        if (ollamaStatus.available) {
          console.log("🧠 Fetching models...");
          const { models } = await llm.models();
          setOllamaModels(models);
          console.log(`✅ Found ${models.length} models.`);
        }

        // Fetch Chat History
        console.log("📜 Fetching chat sessions...");
        await fetchChatSessions();
        if (currentSessionId) {
            console.log(`💬 Loading session: ${currentSessionId}`);
            await handleSelectSession(currentSessionId);
        }

        // Fetch File Tree
        console.log(`📂 Loading file tree for: ${rootPath}`);
        const entries = await fs.getFileTree(rootPath);
        setFileTree(entries);
        console.log(`✅ File tree loaded: ${entries.length} entries.`);

        // Update Watcher
        console.log("👀 Starting file watcher...");
        await fs.watchDirectory(rootPath);

        // Fetch Git Branch
        console.log("🌿 Fetching git branch...");
        try {
            const { branch } = await git.getBranch();
            setCurrentBranch(branch);
            console.log(`✅ Current branch: ${branch}`);
        } catch (e) {
            console.warn("⚠️ Git not available or error:", e);
            setCurrentBranch("offline");
        }

        console.log("🏁 Boot process complete. Setting isBooting to false.");
        setIsBooting(false);
      } catch (error) {
        console.error("🔥 CRITICAL BOOT ERROR:", error);
        toast({
          title: "Connection Failed",
          description: "An error occurred during startup. Check console for details.",
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
      let ws: WebSocket | null = null;
      let reconnectTimeout: NodeJS.Timeout | null = null;

      const connectFilesSocket = () => {
          ws = new WebSocket("ws://127.0.0.1:8000/ws/files");

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
                          // Auto-index the file if it's not a directory
                          if (data.path && !data.isDirectory) {
                              try {
                                  const { content } = await fs.readFile(data.path);
                                  await rag.indexFile(data.path, content);
                                  console.log(`Auto-indexed updated file: ${data.path}`);
                              } catch (e) {
                                  console.error(`Failed to auto-index ${data.path}`, e);
                              }
                          }

                          toast({
                              title: `File ${data.event === 'created' ? 'Created' : 'Changed'}`,
                              description: `External change: ${data.name}`,
                              action: (
                                  <Button 
                                      variant="outline" 
                                      size="sm" 
                                      onClick={async () => {
                                          try {
                                              if (data.path) {
                                                  const { content } = await fs.readFile(data.path);
                                                  setOpenFiles((prev) => 
                                                      prev.map((f) => (f.path === data.path ? { ...f, content } : f))
                                                  );
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

          ws.onclose = () => {
              console.log("File Watcher disconnected. Reconnecting in 2s...");
              reconnectTimeout = setTimeout(connectFilesSocket, 2000);
          };

          ws.onerror = (err) => {
              console.error("File Watcher Error", err);
              ws?.close();
          };
      };

      connectFilesSocket();

      return () => {
          if (reconnectTimeout) clearTimeout(reconnectTimeout);
          ws?.close();
      };
  }, [rootPath]);

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

  const handleIndexAll = async () => {
    setIsIndexing(true);
    try {
      await rag.indexDirectory(rootPath);
      toast({
        title: "Project Indexed",
        description: "Entire project has been semantically indexed.",
        className: "bg-green-500/10 border-green-500/50 text-green-500",
      });
    } catch (error) {
      toast({
        title: "Indexing Failed",
        description: "Could not index the project.",
        variant: "destructive",
      });
    } finally {
      setIsIndexing(false);
    }
  };

  const handleApplyCode = async (code: string, language?: string) => {
    // 1. Try to parse as JSON Tool Call (Auto-Scaffold)
    try {
        const cleanCode = code.trim();
        if (cleanCode.startsWith("{") && cleanCode.includes("scaffold_project")) {
            const data = JSON.parse(cleanCode);
            if (data.tool === "scaffold_project" && data.arguments?.file_structure) {
                toast({ title: "Auto-Scaffolding", description: "Detected project structure. Creating files..." });
                
                const { base_path, file_structure } = data.arguments;
                let createdCount = 0;

                for (const [filename, content] of Object.entries(file_structure)) {
                    const fullPath = `${base_path}/${filename}`;
                    await fs.writeFile(fullPath, content as string);
                    createdCount++;
                }

                toast({ 
                    title: "Scaffold Complete", 
                    description: `Created ${createdCount} files in ${base_path}/`, 
                    className: "bg-green-500/10 border-green-500/50 text-green-500" 
                });
                
                // Refresh file tree
                const entries = await fs.getFileTree(rootPath);
                setFileTree(entries);
                return;
            }
        }
    } catch (e) {
        // Not valid JSON or not a scaffold command, proceed
    }

    // 2. Try to parse as SEARCH/REPLACE blocks (Surgeon Protocol)
    if (activeFile && code.includes("<<<< SEARCH") && code.includes("==== REPLACE")) {
        try {
            const openFile = openFiles.find(f => f.path === activeFile);
            if (openFile) {
                let newContent = openFile.content;
                // Match all SEARCH/REPLACE blocks
                const blockRegex = /<<<< SEARCH([\s\S]*?)==== REPLACE([\s\S]*?)>>>>/g;
                let match;
                let appliedCount = 0;

                while ((match = blockRegex.exec(code)) !== null) {
                    const searchText = match[1].trim();
                    const replaceText = match[2].trim();

                    if (newContent.includes(searchText)) {
                        newContent = newContent.replace(searchText, replaceText);
                        appliedCount++;
                    } else {
                        console.warn("Surgeon search block not found exactly in file:", searchText);
                    }
                }

                if (appliedCount > 0) {
                    toast({ title: "Surgeon Edit Success", description: `Applied ${appliedCount} precise modifications.` });
                    await fs.writeFile(activeFile, newContent);
                    setOpenFiles(prev => prev.map(f => f.path === activeFile ? { ...f, content: newContent } : f));
                    return;
                } else {
                    toast({ title: "Surgeon Failed", description: "Could not find matching code blocks in the file.", variant: "destructive" });
                }
            }
        } catch (e) {
            console.error("Surgeon error", e);
        }
    }

    if (!activeFile) {
        // No active file? Prompt to save as new file.
        try {
            // Check if fileSystem API is available (Electron)
            if ((window as any).fileSystem?.saveFile) {
                // Determine default extension
                let ext = "txt";
                if (language) {
                    if (language === 'python') ext = 'py';
                    else if (language === 'javascript') ext = 'js';
                    else if (language === 'typescript') ext = 'ts';
                    else if (language === 'html') ext = 'html';
                    else if (language === 'css') ext = 'css';
                    else if (language === 'json') ext = 'json';
                    else if (language === 'markdown') ext = 'md';
                    else if (language === 'bash' || language === 'sh') ext = 'sh';
                }
                const defaultName = `new_file.${ext}`;

                const result = await (window as any).fileSystem.saveFile(defaultName, code);
                if (result.success) {
                    // Open the newly created file
                    await handleFileClick(result.path);
                    toast({
                        title: "File Saved",
                        description: `Saved to ${result.path}`,
                        className: "bg-green-500/10 border-green-500/50 text-green-500",
                    });
                } else if (result.error) {
                    toast({ title: "Save Error", description: result.error, variant: "destructive" });
                }
            } else {
                toast({
                    title: "Not Supported",
                    description: "Save file dialog is only available in the Electron app.",
                    variant: "destructive",
                });
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Failed to save file.", variant: "destructive" });
        }
        return;
    }

    // Active file exists: Use Smart Merge (AI Diff)
    if (editorRef.current) {
        toast({ title: "Analyzing Merge...", description: "AI is figuring out where to insert the code." });
        editorRef.current.triggerSmartMerge(code);
    } else {
        // Fallback to overwrite if editor not mounted (shouldn't happen)
        try {
            await fs.writeFile(activeFile, code);
            setOpenFiles((prev) =>
                prev.map((f) => (f.path === activeFile ? { ...f, content: code } : f))
            );
            toast({ title: "File Overwritten", description: "Editor ref missing, performed direct write.", variant: "destructive" });
        } catch (e) {
            toast({ title: "Write Failed", variant: "destructive" });
        }
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
        const model = localStorage.getItem("ai_model") || "qwen2.5:0.5b";
        const temp = parseFloat(localStorage.getItem("ai_temperature") || "0.4");

        chatSocket.current.send(JSON.stringify({
            type: "chat",
            model,
            messages: newMessages,
            session_id: currentSessionId,
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

      const model = localStorage.getItem("ai_model") || "qwen2.5:0.5b";
      const temp = parseFloat(localStorage.getItem("ai_temperature") || "0.4");

      chatSocket.current.send(JSON.stringify({
          type: "tool_exec",
          model,
          messages: chatMessages,
          tool_call: toolCall,
          session_id: currentSessionId,
          approved,
          options: { temperature: temp }
      }));
  };

  const handleStopGeneration = () => {
    if (chatSocket.current && chatSocket.current.readyState === WebSocket.OPEN) {
        chatSocket.current.send(JSON.stringify({ type: "stop" }));
        setIsChatLoading(false);
        toast({ title: "Stopped", description: "AI generation cancelled." });
    }
  };

  const handleCommand = async (command: string, args: string) => {
    switch (command) {
      case "clear":
        setChatMessages([]);
        toast({ title: "Chat Cleared" });
        break;
      case "index":
        if (!activeFile) {
          toast({ title: "No file selected", variant: "destructive" });
          return;
        }
        await handleIndex();
        break;
      case "index-all":
        await handleIndexAll();
        break;
      case "fix":
        if (!activeFile) {
          toast({ title: "No file selected", variant: "destructive" });
          return;
        }
        handleSendMessage(`Propose a fix for the current file: ${activeFile}. Here is the content:\n\n\`\`\`\n${activeFileContent}\n\`\`\``);
        break;
      case "explain":
        if (!activeFile) {
          toast({ title: "No file selected", variant: "destructive" });
          return;
        }
        handleSendMessage(`Explain the following code in ${activeFile}:\n\n\`\`\`\n${activeFileContent}\n\`\`\``);
        break;
      case "test":
        if (!activeFile) {
          toast({ title: "No file selected", variant: "destructive" });
          return;
        }
        handleSendMessage(`Generate unit tests for the following code in ${activeFile}:\n\n\`\`\`\n${activeFileContent}\n\`\`\``);
        break;
      case "model":
        if (!args) {
          setChatMessages(prev => [...prev, { 
            role: "assistant", 
            content: `Current model: **${localStorage.getItem("ai_model") || "qwen2.5:0.5b"}**\n\nAvailable models:\n${ollamaModels.map(m => `- \`/model ${m}\``).join("\n")}`}]);
          return;
        }
        if (ollamaModels.includes(args)) {
          localStorage.setItem("ai_model", args);
          setChatMessages(prev => [...prev, { role: "assistant", content: `Switched to model: **${args}**` }]);
          toast({ title: "Model Switched", description: `Active model is now ${args}` });
        } else {
          toast({ title: "Model not found", description: `Model '${args}' is not installed in Ollama.`, variant: "destructive" });
        }
        break;
      case "status":
        setChatMessages(prev => [...prev, {
          role: "assistant",
          content: "### System Status\n\n" +
                   `- **Active Model**: ${localStorage.getItem("ai_model") || "qwen2.5:0.5b"}\n` +
                   `- **Context File**: ${activeFile ? `\`${activeFile}\`` : "None"}\n` +
                   `- **AI Backend**: ${ollamaAvailable ? "Online 🟢" : "Offline 🔴"}\n` +
                   `- **Git Branch**: \`${currentBranch}\`\n`
        }]);
        break;
      case "browse":
        if (!args) {
          toast({ title: "Query required", description: "Please provide a search query or URL.", variant: "destructive" });
          return;
        }
        if (args.startsWith("http")) {
          handleSendMessage(`Fetch and summarize this URL: ${args}`);
        } else {
          handleSendMessage(`Search Google for: ${args} and summarize the top results.`);
        }
        break;
      case "help":
        setChatMessages(prev => [...prev, { 
          role: "assistant", 
          content: "### Available Commands\n\n" +
                   "- `/clear`: Clear the current chat history.\n" +
                   "- `/fix`: Propose a bug fix or optimization for the active file.\n" +
                   "- `/explain`: Provide a detailed explanation of the active file.\n" +
                   "- `/test`: Generate unit tests for the active file.\n" +
                   "- `/model <name>`: Switch the active AI model.\n" +
                   "- `/index`: Manually index the active file for AI context.\n" +
                   "- `/index-all`: Index the entire project for comprehensive context awareness.\n" +
                   "- `/browse <query|url>`: Search the web or fetch content from a URL.\n" +
                   "- `/status`: Show current session and system status.\n" +
                   "- `/help`: Show this help message." 
        }]);
        break;
      default:
        toast({ title: "Unknown command", description: `Command /${command} not recognized.`, variant: "destructive" });
    }
  };


  const handleTerminalCommand = (command: string) => {
      if (chatSocket.current && chatSocket.current.readyState === WebSocket.OPEN) {
          chatSocket.current.send(JSON.stringify({
              type: "terminal_command",
              command: command,
              session_id: activeTerminal,
          }));
      } else {
          toast({
              title: "Terminal Command",
              description: "Terminal is not connected.",
              variant: "destructive",
          });
      }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Toggle Sidebar (Ctrl+B)
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            toggleSidebar();
        }
        
        // Toggle Panel (Ctrl+J or Ctrl+`)
        if ((e.ctrlKey || e.metaKey) && (e.key === 'j' || e.key === '`')) {
            e.preventDefault();
            togglePanel();
        }
        
        // Focus Explorer (Ctrl+Shift+E)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
            e.preventDefault();
            handleViewChange('explorer');
        }

        // Focus Search (Ctrl+Shift+F)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
            e.preventDefault();
            handleViewChange('search');
        }

        // Focus Source Control (Ctrl+Shift+G)
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
            e.preventDefault();
            handleViewChange('git');
        }
        
        // Save File (Ctrl+S)
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            handleSave();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarVisible, activeView, activeFile, activeFileContent, isPanelVisible]);

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
          <div className="w-12 bg-black/20 border-r border-border flex flex-col items-center py-2 space-y-2">
              <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-10 w-10 rounded-none", activeView === 'explorer' && isSidebarVisible ? "text-foreground border-l-2 border-primary" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => handleViewChange('explorer')}
                  title="File Explorer (Ctrl+Shift+E)"
              >
                  <Files className="w-5 h-5" />
              </Button>
              <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-10 w-10 rounded-none", activeView === 'search' && isSidebarVisible ? "text-foreground border-l-2 border-primary" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => handleViewChange('search')}
                  title="Search (Ctrl+Shift+F)"
              >
                  <Search className="w-5 h-5" />
              </Button>
              <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-10 w-10 rounded-none", activeView === 'git' && isSidebarVisible ? "text-foreground border-l-2 border-primary" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => handleViewChange('git')}
                  title="Source Control (Ctrl+Shift+G)"
              >
                  <GitBranch className="w-5 h-5" />
              </Button>
              <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-10 w-10 rounded-none text-muted-foreground hover:text-foreground")}
                  onClick={() => {}}
                  title="Extensions"
              >
                  <Blocks className="w-5 h-5" />
              </Button>
              <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-10 w-10 rounded-none", activeView === 'system' && isSidebarVisible ? "text-foreground border-l-2 border-primary" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => handleViewChange('system')}
                  title="System Health"
              >
                  <HeartPulse className="w-5 h-5" />
              </Button>
              <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-10 w-10 rounded-none text-muted-foreground hover:text-foreground")}
                  onClick={handleOpenFileManager}
                  title="Open File Manager"
              >
                  <LayoutGrid className="w-5 h-5" />
              </Button>
              <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-10 w-10 rounded-none", activeFile === 'system://browser' ? "text-foreground border-l-2 border-primary" : "text-muted-foreground hover:text-foreground")}
                  onClick={handleOpenBrowser}
                  title="Web Browser"
              >
                  <Globe className="w-5 h-5" />
              </Button>
              
              <div className="flex-1" />
              
              <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-none text-muted-foreground hover:text-foreground"
                  onClick={() => setIsSettingsOpen(true)}
                  title="Settings"
              >
                  <Settings className="w-5 h-5" />
              </Button>
          </div>

          <ResizablePanelGroup direction="horizontal">
              {/* Left Sidebar: File Explorer OR Git */}
              {isSidebarVisible && (
                  <>
                      <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="bg-card/20 backdrop-blur-sm border-r border-border">
                          {activeView === 'explorer' && (
                              <div className="h-full flex flex-col">
                                  <div className="p-2 flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50">
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
                                  
                                  <div className="flex-1 overflow-y-auto no-scrollbar">
                                      {/* Open Editors Section */}
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

                                      {/* Project Folder Section */}
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
                                                <Button variant="outline" size="sm" onClick={handleOpenFolder} className="text-xs">
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
                      </ResizablePanel>
                      
                      <ResizableHandle className="bg-border hover:bg-primary transition-colors" />
                  </>
              )}

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
                                        {activeFile === "system://file-manager" ? (
                                            <FileManager 
                                                initialPath={rootPath} 
                                                onFileOpen={handleFileClick} 
                                            />
                                        ) : activeFile === "system://browser" ? (
                                            <BrowserPanel initialUrl={browserUrl} />
                                        ) : (
                                            <CodeEditor 
                                                ref={editorRef}
                                                content={activeFileContent} 
                                                filePath={activeFile} 
                                                onChange={handleEditorChange}
                                                onSave={handleSave}
                                                onIndex={handleIndex}
                                                onRun={handleRunHtml}
                                                isIndexing={isIndexing}
                                            />
                                        )}
                                    </div>
                                </>
                            ) : (
                                <Welcome onOpenFolder={handleOpenFolder} onOpenFile={handleOpenFiles} />
                            )}
                          </div>
                      </ResizablePanel>
                      
                      {isPanelVisible && (
                          <>
                              <ResizableHandle className="bg-border hover:bg-primary transition-colors" />
                              
                              <ResizablePanel defaultSize={25} minSize={10}>
                                  <TerminalManager 
                                    sessions={terminalSessions}
                                    setSessions={setTerminalSessions}
                                    activeTab={activeTerminal}
                                    setActiveTab={setActiveTerminal}
                                  />
                              </ResizablePanel>
                          </>
                      )}
                  </ResizablePanelGroup>
              </ResizablePanel>

              <ResizableHandle className="bg-border hover:bg-accent transition-colors" />

              {/* Right Sidebar: AI Chat */}
              <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
                  <ChatPanel 
                      messages={chatMessages} 
                      onSendMessage={handleSendMessage} 
                      onCommand={handleCommand}
                      onStopGeneration={handleStopGeneration}
                      onRemoveContext={() => setActiveFile(null)}
                      isLoading={isChatLoading}
                      activeFile={activeFile}
                      ollamaAvailable={ollamaAvailable}
                      ollamaModels={ollamaModels}
                      onClearChat={() => setChatMessages([])}
                      hasCheckedOllama={hasCheckedOllama}
                      onApplyCode={handleApplyCode}
                      onToolAction={handleToolAction}
                      onTerminalCommand={handleTerminalCommand}
                      // History Props
                      sessions={chatSessions}
                      currentSessionId={currentSessionId}
                      onSelectSession={handleSelectSession}
                      onNewChat={handleNewChat}
                      onDeleteSession={handleDeleteSession}
                  />
              </ResizablePanel>
          </ResizablePanelGroup>
         </div>
         
         {/* Status Bar */}
         <StatusBar 
            currentBranch={currentBranch} 
            activeFile={activeFile} 
            isIndexing={isIndexing}
            lspStatus={lspStatus}
         />

         <Toaster />
         <DownloadWidget />
         <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
         <CommandPalette 
            onOpenFiles={handleOpenFiles}
            onOpenFolder={handleOpenFolder}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onToggleTerminal={() => {}} // Terminal toggling logic
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

export default App;