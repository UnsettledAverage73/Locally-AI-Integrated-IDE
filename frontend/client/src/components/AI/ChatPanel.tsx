import React, { useState, useRef, useEffect, useMemo } from "react";
import { Send, Bot, User, Sparkles, Eraser, Play, AlertTriangle, Check, X, Settings, Info, LayoutGrid, Square, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage, ToolCall } from "../../types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { rag } from "../../api/client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  onCommand: (command: string, args: string) => void;
  onStopGeneration: () => void;
  onRemoveContext: () => void;
  isLoading: boolean;
  activeFile: string | null;
  ollamaAvailable: boolean;
  ollamaModels: string[];
  onClearChat: () => void;
  hasCheckedOllama: boolean;
  onApplyCode: (code: string) => void;
  onToolAction: (toolCall: ToolCall, approved: boolean) => void;
  onTerminalCommand: (command: string) => void;
}

export default function ChatPanel({ messages, onSendMessage, onCommand, onStopGeneration, onRemoveContext, isLoading, activeFile, ollamaAvailable, ollamaModels, onClearChat, hasCheckedOllama, onApplyCode, onToolAction, onTerminalCommand }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const commands = [
    { name: "clear", description: "Clear chat history", icon: <Eraser className="w-3.5 h-3.5" /> },
    { name: "fix", description: "Propose a fix for the current file", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { name: "explain", description: "Explain the current file", icon: <Bot className="w-3.5 h-3.5" /> },
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    if (input.startsWith("/")) {
      const parts = input.slice(1).split(" ");
      const command = parts[0].toLowerCase();
      const args = parts.slice(1).join(" ");
      onCommand(command, args);
    } else {
      onSendMessage(input);
    }
    setInput("");
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

  // Custom component to render code blocks with syntax highlighting and "Apply" button
  const CodeBlock = useMemo(() => ({ inline, className, children, ...props }: any) => {
// ... existing CodeBlock code ...
    const match = /language-(\w+)/.exec(className || '');
    const codeContent = String(children).replace(/\n$/, '');
    const language = match ? match[1].toLowerCase() : '';
    const isShell = ['bash', 'sh', 'shell', 'powershell', 'ps1', 'cmd'].includes(language);

    const sanitizeShellCommand = (cmd: string) => {
        // Handle common LLM tool-call hallucinations in code blocks
        // Pattern 1: run_shell_command(command="ls -la")
        const pattern1 = cmd.match(/run_shell_command\s*\(\s*command\s*=\s*["'](.+?)["']\s*\)/s);
        if (pattern1) return pattern1[1];

        // Pattern 2: run_shell_command("ls -la")
        const pattern2 = cmd.match(/run_shell_command\s*\(\s*["'](.+?)["']\s*\)/s);
        if (pattern2) return pattern2[1];

        // Pattern 3: run_shell_command: ls -la
        const pattern3 = cmd.match(/run_shell_command\s*:\s*(.+)/s);
        if (pattern3) return pattern3[1].trim();

        return cmd;
    };

    return !inline && match ? (
      <div className="relative group my-4 rounded-md overflow-hidden border border-border/50 bg-[#1e1e1e]">
          {/* Code Header / Actions */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#252526] border-b border-border/40 select-none group-hover:border-border/60 transition-colors">
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
                        className="h-5 text-[10px] gap-1 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 transition-colors px-2"
                        onClick={() => onTerminalCommand(sanitizeShellCommand(codeContent))}
                        title="Run in Terminal"
                     >
                        <Play className="w-2.5 h-2.5" />
                        RUN
                     </Button>
                ) : activeFile ? (
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-5 text-[10px] gap-1 text-green-400 hover:text-green-300 hover:bg-green-400/10 transition-colors px-2"
                        onClick={() => onApplyCode(codeContent)}
                        title={`Apply code to ${activeFile}`}
                     >
                        <Play className="w-2.5 h-2.5" />
                        APPLY
                     </Button>
                ) : null}
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
    <div className="h-full flex flex-col bg-card/40 backdrop-blur-xl border-l border-border/50 shadow-2xl relative z-10">
      {/* Header */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-border/50 bg-background/20 select-none">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-accent/10">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
          </div>
          <span className="text-xs font-medium tracking-wide text-foreground/90">AI ASSISTANT</span>
        </div>
        <Button variant="ghost" size="icon" onClick={handleClearIndex} title="Clear AI Index and Chat" className="h-7 w-7 hover:bg-red-500/10 hover:text-red-400 transition-colors">
          <Eraser className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
      >
        {messages.length === 0 && hasCheckedOllama && (
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full text-muted-foreground/80 space-y-4"
            >
                <div className="relative">
                    <Bot className="w-12 h-12 opacity-80 text-accent" />
                    {ollamaAvailable && (
                        <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                    )}
                </div>
                
                {ollamaAvailable ? (
                    <div className="text-center max-w-[240px] space-y-2">
                        <h3 className="font-semibold text-foreground">System Online</h3>
                        <div className="bg-background/40 border border-border/50 rounded-lg p-3 text-xs font-mono text-left space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Model:</span>
                                <span className="text-accent">{ollamaModels[0] || "deepseek-coder"}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status:</span>
                                <span className="text-green-500">Ready</span>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Ask questions or select code to generate snippets.</p>
                    </div>
                ) : (
                    <div className="text-center max-w-[300px] bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                        <h3 className="font-semibold text-red-500 flex items-center justify-center gap-2 mb-2">
                            <AlertTriangle className="w-4 h-4" />
                            Ollama Not Found
                        </h3>
                        <p className="text-xs mb-3">AI features require a local Ollama instance.</p>
                        <div className="text-left text-[10px] space-y-2 bg-background/50 p-2 rounded border border-border/30 font-mono">
                            <p className="flex gap-2"><span>1.</span> <span className="opacity-80">Install ollama.ai</span></p>
                            <p className="flex gap-2"><span>2.</span> <span className="text-accent">ollama serve</span></p>
                            <p className="flex gap-2"><span>3.</span> <span className="text-accent">ollama run deepseek-coder</span></p>
                        </div>
                    </div>
                )}
            </motion.div>
        )}

        {messages.filter(m => m.role !== 'system' || m.type === 'permission_request').map((msg, i) => {
            // 1. Permission Request Card
            if (msg.type === 'permission_request' && msg.tool_calls && msg.tool_calls.length > 0) {
                return (
                    <motion.div 
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full bg-[#1e1e1e] border border-yellow-500/30 rounded-lg p-0 shadow-lg my-4 overflow-hidden"
                    >
                        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
                            <AlertTriangle className="w-4 h-4 text-yellow-500" />
                            <span className="font-semibold text-xs text-yellow-500 uppercase tracking-wide">Permission Required</span>
                        </div>
                        
                        {msg.tool_calls.map((tool, tIdx) => (
                            <div key={tIdx} className="p-4">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="p-2 bg-background/50 rounded border border-border/50">
                                        <Bot className="w-5 h-5 text-accent" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-foreground">I want to execute a command</p>
                                        <p className="text-xs text-muted-foreground">This action will modify your system or files.</p>
                                    </div>
                                </div>

                                <div className="bg-black/30 p-3 rounded-md border border-border/40 font-mono text-xs overflow-x-auto mb-4">
                                    <div className="flex items-center gap-2 mb-1.5 opacity-70 border-b border-border/20 pb-1">
                                        <span className="text-accent font-bold">{tool.function.name}</span>
                                    </div>
                                    <div className="text-gray-300 whitespace-pre-wrap">
                                        {(() => {
                                            const args = typeof tool.function.arguments === 'string' 
                                                ? JSON.parse(tool.function.arguments) 
                                                : tool.function.arguments;
                                            
                                            if (tool.function.name === 'scaffold_project') {
                                                return (
                                                    <div>
                                                        <div className="text-blue-400 mb-1">Base Path: {args.base_path}</div>
                                                        <div className="text-muted-foreground mt-2">Files to create:</div>
                                                        <ul className="list-disc pl-4 mt-1">
                                                            {Object.keys(args.file_structure || {}).map(f => (
                                                                <li key={f} className="text-[10px]">{f}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                );
                                            }
                                            return <pre>{JSON.stringify(args, null, 2)}</pre>;
                                        })()}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <Button 
                                        size="sm" 
                                        onClick={() => onToolAction(tool, true)}
                                        className="bg-green-600 hover:bg-green-700 text-white border-none shadow-none text-xs"
                                    >
                                        <Check className="w-3.5 h-3.5 mr-1.5" /> Approve
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        variant="outline"
                                        onClick={() => onToolAction(tool, false)}
                                        className="bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs"
                                    >
                                        <X className="w-3.5 h-3.5 mr-1.5" /> Deny
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </motion.div>
                );
            }

            // 2. Standard Chat Bubble
            return (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                        "flex w-full flex-col gap-1",
                        msg.role === "user" ? "items-end" : "items-start"
                    )}
                >
                    <div className={cn(
                        "flex items-center gap-2 mb-1 px-1",
                        msg.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}>
                        <span className="text-[10px] uppercase font-bold text-muted-foreground opacity-70">
                            {msg.role === "user" ? "You" : "Assistant"}
                        </span>
                    </div>

                    <div className={cn(
                        "flex max-w-[90%] rounded-2xl p-3.5 text-sm shadow-sm relative group",
                        msg.role === "user" 
                            ? "bg-accent/10 text-foreground border border-accent/20 rounded-tr-sm" 
                            : "bg-muted/40 text-foreground border border-border/40 rounded-tl-sm backdrop-blur-sm"
                    )}>
                        <div className="leading-relaxed prose prose-invert prose-p:my-1 prose-pre:my-2 prose-code:bg-black/20 prose-code:rounded prose-code:px-1 max-w-none break-words overflow-hidden w-full">
                            <ReactMarkdown 
                                remarkPlugins={[remarkGfm]} 
                                components={{
                                    code: CodeBlock, 
                                    a: ({ node, ...props }) => <a {...props} className="text-accent underline hover:text-accent/80 transition-colors" target="_blank" rel="noopener noreferrer" />,
                                    ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-4 space-y-1" />,
                                    ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-4 space-y-1" />
                                }}
                            >
                                {msg.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                </motion.div>
            );
        })}

        {isLoading && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start w-full px-1"
            >
                <div className="bg-muted/40 border border-border/40 rounded-2xl rounded-tl-sm p-4 flex items-center space-x-3 shadow-sm">
                    <div className="relative">
                         <Bot className="w-4 h-4 text-accent" />
                         <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                        </span>
                    </div>
                    <div className="flex space-x-1.5">
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 bg-foreground/40 rounded-full" />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-foreground/40 rounded-full" />
                        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-foreground/40 rounded-full" />
                    </div>
                </div>
            </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/50 bg-background/30 backdrop-blur-md relative">
        <AnimatePresence>
          {showCommands && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-full left-3 right-3 mb-2 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50"
            >
              <div className="p-2 border-b border-border/50 bg-muted/30">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Available Commands</span>
              </div>
              <div className="max-h-[200px] overflow-y-auto p-1">
                {filteredCommands.map((cmd) => (
                  <button
                    key={cmd.name}
                    onClick={() => handleCommandClick(cmd.name)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors text-left group"
                  >
                    <div className="p-1.5 rounded-md bg-muted group-hover:bg-accent-foreground/10 transition-colors">
                      {cmd.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">/{cmd.name}</div>
                      <div className="text-[10px] text-muted-foreground group-hover:text-accent-foreground/70">{cmd.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activeFile && (
            <div className="mb-2 text-[10px] text-muted-foreground flex items-center bg-accent/5 w-fit px-2 py-0.5 rounded-full border border-accent/10 group/ctx">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse" />
                <span className="opacity-70">Context:</span> 
                <span className="ml-1 font-mono text-foreground/80">{activeFile.split('/').pop()}</span>
                <button 
                  onClick={onRemoveContext}
                  className="ml-1.5 hover:text-red-400 transition-colors opacity-0 group-hover/ctx:opacity-100"
                  title="Remove context"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
            </div>
        )}
        <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-muted/30 border border-border/50 rounded-xl p-1.5 focus-within:ring-1 focus-within:ring-accent/50 focus-within:border-accent/50 transition-all shadow-sm">
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Ask AI about your code..." 
            className="flex-1 bg-transparent border-none focus-visible:ring-0 text-sm h-auto min-h-[40px] py-2.5 px-3 resize-none"
            autoComplete="off"
          />
          {isLoading ? (
            <Button 
              type="button"
              size="icon" 
              onClick={onStopGeneration}
              className="h-9 w-9 shrink-0 bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-all border border-red-500/20"
              title="Stop Generation"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </Button>
          ) : (
            <Button 
              type="submit" 
              size="icon" 
              disabled={!input.trim()}
              className={cn(
                  "h-9 w-9 shrink-0 transition-all",
                  input.trim() ? "bg-accent text-accent-foreground hover:bg-accent/90" : "bg-muted text-muted-foreground"
              )}
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </form>
        <div className="text-[10px] text-center mt-2 text-muted-foreground/40 select-none">
            AI can make mistakes. Review generated code.
        </div>
      </div>
    </div>
  );
}
