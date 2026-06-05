import React, { useState, useRef, useEffect, useMemo } from "react";
import { Send, Bot, User, Sparkles, Eraser, Play, AlertTriangle, Check, X, Settings, Info, LayoutGrid, Square, Globe, History, Plus, Paperclip, Image as ImageIcon, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage, ToolCall } from "../../types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { rag } from "../../api/client";
import ChatHistory from "./ChatHistory";
import ComposerOverlay from "./ComposerOverlay";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string, images?: string[]) => void;
  onCommand: (command: string, args: string) => void;
  onStopGeneration: () => void;
  onRemoveContext: () => void;
  isLoading: boolean;
  activeFile: string | null;
  ollamaAvailable: boolean;
  ollamaModels: string[];
  onClearChat: () => void;
  hasCheckedOllama: boolean;
  onApplyCode: (code: string, language?: string) => void;
  onToolAction: (toolCall: ToolCall, approved: boolean) => void;
  onTerminalCommand: (command: string) => void;
  // History Props
  sessions: any[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
}

export default function ChatPanel({
  messages,
  onSendMessage,
  onCommand,
  onStopGeneration,
  onRemoveContext,
  isLoading,
  activeFile,
  ollamaAvailable,
  ollamaModels,
  onClearChat,
  hasCheckedOllama,
  onApplyCode,
  onToolAction,
  onTerminalCommand,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession
}: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showCommands, setShowCommands] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const commands = [
    { name: "clear", description: "Clear chat history", icon: <Eraser className="w-3.5 h-3.5" /> },
    { name: "fix", description: "Propose a fix for the current file", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { name: "explain", description: "Explain the current file", icon: <Bot className="w-3.5 h-3.5" /> },
    { name: "compose", description: "Multi-file architect mode", icon: <Layers className="w-3.5 h-3.5" /> },
    { name: "test", description: "Generate tests for the current file", icon: <Play className="w-3.5 h-3.5" /> },
    { name: "index", description: "Index current file for context", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { name: "index-all", description: "Index entire project", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
    { name: "browse", description: "Search the web or fetch a URL", icon: <Globe className="w-3.5 h-3.5" /> },
    { name: "model", description: "Switch active AI model", icon: <Settings className="w-3.5 h-3.5" /> },
    { name: "status", description: "Show session status", icon: <Info className="w-3.5 h-3.5" /> },
    { name: "help", description: "Show available commands", icon: <Bot className="w-3.5 h-3.5" /> },
  ];

  const filteredCommands = useMemo(() => {
    if (!input.startsWith("/")) return [];
    const search = input.slice(1).toLowerCase();
    return commands.filter(c => c.name.startsWith(search));
  }, [input]);

  useEffect(() => {
    setShowCommands(input === "/" || (input.startsWith("/") && filteredCommands.length > 0));
  }, [input, filteredCommands]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleCommandClick = (cmd: string) => {
    onCommand(cmd, "");
    setInput("");
    setShowCommands(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
        const base64String = reader.result as string;
        setAttachments(prev => [...prev, base64String]);
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    if (input.startsWith("/")) {
      const parts = input.slice(1).split(" ");
      const command = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");
      onCommand(command, args);
    } else {
      onSendMessage(input, attachments); 
    }
    setInput("");
    setAttachments([]);
    setShowCommands(false);
  };

  const handleClearIndex = async () => {
    try {
      await rag.clearIndex();
      onClearChat();
      toast({
        title: "Index Cleared",
        description: "RAG index and chat history cleared.",
        className: "bg-green-500/10 border-green-500/50 text-green-500",
      });
    } catch (error) {
      toast({
        title: "Error Clearing Index",
        description: "Could not clear RAG index.",
        variant: "destructive",
      });
    }
  };

  const CodeBlock = useMemo(() => ({ inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeContent = String(children).replace(/\n$/, '');
    const language = match ? match[1].toLowerCase() : '';
    const isShell = ['bash', 'sh', 'shell', 'powershell', 'ps1', 'cmd'].includes(language);

    // --- SMART BLUEPRINT DETECTION ---
    try {
        if ((language === 'json' || !language) && codeContent.trim().startsWith('{')) {
            const data = JSON.parse(codeContent);
            if (data.tool === 'scaffold_project' || (data.name === 'scaffold_project')) {
                const args = data.arguments || data;
                const fileCount = Object.keys(args.file_structure || {}).length;

                return (
                    <div className="my-4 rounded-xl border border-accent/30 bg-accent/5 overflow-hidden shadow-lg">
                        <div className="bg-accent/10 px-4 py-2 border-b border-accent/20 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <LayoutGrid className="w-4 h-4 text-accent" />
                                <span className="font-bold text-xs text-accent uppercase tracking-wider">Project Blueprint</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">
                                {fileCount} Files
                            </span>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="text-xs text-muted-foreground/80">
                                <span className="font-mono text-accent">{args.base_path}</span>
                            </div>
                            <div className="max-h-[100px] overflow-y-auto space-y-1 pr-2">
                                {Object.keys(args.file_structure || {}).map(f => (
                                    <div key={f} className="flex items-center gap-2 text-[10px] text-foreground/70">
                                        <Info className="w-3 h-3 opacity-50 text-accent" />
                                        {f}
                                    </div>
                                ))}
                            </div>
                            <Button
                                className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-md font-semibold tracking-wide text-xs h-8"
                                onClick={() => onApplyCode(codeContent)}
                            >
                                <Play className="w-3.5 h-3.5 mr-2" />
                                BUILD PROJECT
                            </Button>
                        </div>
                    </div>
                );
            }
        }
    } catch (e) {}

    return !inline && match ? (
      <div className="relative group my-4 rounded-md overflow-hidden border border-border/50 bg-[#1e1e1e]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-border/40 select-none">
             <div className="flex items-center gap-2">
                <div className="flex gap-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/20" />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider ml-1">{language}</span>
             </div>
             <div className="flex items-center gap-2">
                {isShell ? (
                     <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-[10px] gap-1 text-blue-400 hover:text-blue-300 transition-colors px-2"
                        onClick={() => onTerminalCommand(codeContent)}
                     >
                        <Play className="w-2.5 h-2.5" />
                        RUN
                     </Button>
                ) : (
                     <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 text-[10px] gap-1 text-green-400 hover:text-green-300 transition-colors px-2"
                        onClick={() => onApplyCode(codeContent, language)}
                     >
                        {activeFile ? "APPLY" : "SAVE"}
                     </Button>
                )}
             </div>
          </div>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match[1]}
            PreTag="div"
            customStyle={{ margin: 0, padding: '1rem', borderRadius: 0, fontSize: '0.85rem', lineHeight: '1.4', backgroundColor: '#1e1e1e' }}
            {...props}
          >
            {codeContent}
          </SyntaxHighlighter>
      </div>
    ) : (
      <code className={cn("relative rounded bg-muted/50 px-[0.3rem] py-[0.1rem] font-mono text-sm border border-border/50 text-accent", className)} {...props}>
        {children}
      </code>
    );
  }, [activeFile, onApplyCode, onTerminalCommand]);

  return (
    <div className="h-full flex bg-card/40 backdrop-blur-xl border-l border-border/50 shadow-2xl relative z-10 overflow-hidden font-sans">
      {/* History Sidebar */}
      {showHistory && (
        <div className="w-64 flex-shrink-0 border-r border-border/50 animate-in slide-in-from-left duration-200">
          <ChatHistory
            sessions={sessions}
            currentSessionId={currentSessionId}
            onSelectSession={(id) => {
              onSelectSession(id);
              setShowHistory(false);
            }}
            onNewChat={() => {
              onNewChat();
              setShowHistory(false);
            }}
            onDeleteSession={onDeleteSession}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-10 px-3 flex items-center justify-between border-b border-border/50 bg-background/20 select-none">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHistory(!showHistory)}
              className={cn("h-7 w-7 transition-colors", showHistory ? "text-accent bg-accent/10" : "text-muted-foreground")}
              title="Toggle History"
            >
              <History className="w-3.5 h-3.5" />
            </Button>
            <div className="p-1 rounded bg-accent/10 ml-1">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
            </div>
            <span className="text-xs font-medium tracking-wide text-foreground/90 uppercase truncate max-w-[150px]">
              {currentSessionId ? sessions.find(s => s.id === currentSessionId)?.title || "AI ASSISTANT" : "AI ASSISTANT"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onNewChat} title="New Chat" className="h-7 w-7 text-muted-foreground hover:text-accent transition-colors">
              <Plus className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleClearIndex} title="Clear AI Index and Chat" className="h-7 w-7 hover:bg-red-500/10 hover:text-red-400 transition-colors ml-1">
              <Eraser className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
        >
          {messages.length === 0 && hasCheckedOllama && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/80 space-y-4">
                  <Bot className="w-12 h-12 opacity-80 text-accent" />
                  <div className="text-center max-w-[240px] space-y-2">
                      <h3 className="font-semibold text-foreground">System Online</h3>
                      <p className="text-xs">Ask questions or select code to generate snippets.</p>
                  </div>
              </div>
          )}

          {messages.filter(m => m.role !== 'system' || m.type === 'permission_request').map((msg, i) => {
              if (msg.type === 'permission_request' && msg.tool_calls && msg.tool_calls.length > 0) {
                  return (
                      <div key={i} className="w-full bg-[#1e1e1e] border border-yellow-500/30 rounded-lg p-0 shadow-lg my-4 overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-500 text-xs font-semibold">
                              <AlertTriangle className="w-4 h-4" /> PERMISSION REQUIRED
                          </div>
                          {msg.tool_calls.map((tool, tIdx) => (
                              <div key={tIdx} className="p-4 space-y-3">
                                  <div className="text-sm font-medium text-foreground">Execute {tool.function.name}?</div>
                                  <div className="bg-black/30 p-3 rounded border border-border/40 font-mono text-[10px] truncate text-muted-foreground">
                                      {tool.function.name === 'scaffold_project' ? 'Scaffold Project' : JSON.stringify(tool.function.arguments)}
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                      <Button size="sm" onClick={() => onToolAction(tool, true)} className="bg-green-600 hover:bg-green-700 text-white">Approve</Button>
                                      <Button size="sm" variant="outline" onClick={() => onToolAction(tool, false)} className="text-red-400 border-red-500/30">Deny</Button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  );
              }

              return (
                  <div key={i} className={cn("flex w-full flex-col gap-1", msg.role === "user" ? "items-end" : "items-start")}>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground opacity-70 px-1">{msg.role === "user" ? "You" : "Assistant"}</span>
                      <div className={cn("flex max-w-[90%] rounded-2xl p-3.5 text-sm shadow-sm relative group border", msg.role === "user" ? "bg-accent/10 border-accent/20 rounded-tr-sm" : "bg-muted/40 border-border/40 rounded-tl-sm backdrop-blur-sm")}>
                          <div className="leading-relaxed prose prose-invert prose-p:my-1 prose-pre:my-2 max-w-none break-words overflow-hidden w-full">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>{msg.content}</ReactMarkdown>
                          </div>
                      </div>
                  </div>
              );
          })}

          {isLoading && (
              <div className="flex justify-start w-full px-1">
                  <div className="bg-muted/40 border border-border/40 rounded-2xl rounded-tl-sm p-4 flex items-center space-x-3 shadow-sm">
                      <Bot className="w-4 h-4 text-accent animate-pulse" />
                      <div className="flex space-x-1.5">
                          <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" />
                          <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                          <div className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                      </div>
                  </div>
              </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-border/50 bg-background/30 backdrop-blur-md">
          {activeFile && (
              <div className="mb-2 text-[10px] text-muted-foreground flex items-center bg-accent/5 w-fit px-2 py-0.5 rounded-full border border-accent/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" />
                  <span className="opacity-70">Context: {activeFile.split('/').pop()}</span>
                  <button onClick={onRemoveContext} className="ml-1.5 hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
              </div>
          )}

          {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                  {attachments.map((at, idx) => (
                      <div key={idx} className="relative group w-12 h-12 rounded-md border border-border overflow-hidden bg-muted/20">
                          <img src={at} className="w-full h-full object-cover" />
                          <button 
                            onClick={() => removeAttachment(idx)}
                            className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                              <X className="w-2 h-2" />
                          </button>
                      </div>
                  ))}
              </div>
          )}

          <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-muted/30 border border-border/50 rounded-xl p-1.5 focus-within:ring-1 focus-within:ring-accent/50 transition-all shadow-sm">
            <div className="flex flex-col flex-1">
                <Input 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)} 
                    placeholder="Ask AI about your code..." 
                    className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm h-auto min-h-[40px] py-2.5" 
                    autoComplete="off" 
                />
            </div>
            
            <div className="flex items-center gap-1.5 pr-1.5 pb-1">
                <input 
                    type="file" 
                    id="attachment-input" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleFileChange}
                />
                <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-accent rounded-lg"
                    onClick={() => document.getElementById('attachment-input')?.click()}
                >
                    <Paperclip className="w-4 h-4" />
                </Button>
                
                {isLoading ? (
                    <Button type="button" size="icon" onClick={onStopGeneration} className="h-8 w-8 bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-all border border-red-500/20 shadow-none rounded-lg"><Square className="w-3 h-3 fill-current" /></Button>
                ) : (
                    <Button type="submit" size="icon" disabled={!input.trim() && attachments.length === 0} className={cn("h-8 w-8 shrink-0 transition-all shadow-none rounded-lg", (input.trim() || attachments.length > 0) ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-muted text-muted-foreground")}><Send className="w-3.5 h-3.5" /></Button>
                )}
            </div>
          </form>
          <div className="text-[10px] text-center mt-2 text-muted-foreground/40 select-none">
              AI can make mistakes. Review generated code.
          </div>
        </div>
      </div>
    </div>
  );
}
