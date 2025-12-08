import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatMessage } from "../../types";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface ChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  activeFile: string | null;
  ollamaAvailable: boolean;
  ollamaModels: string[];
}

export default function ChatPanel({ messages, onSendMessage, isLoading, activeFile, ollamaAvailable, ollamaModels }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input);
    setInput("");
  };

  return (
    <div className="h-full flex flex-col bg-card/30 backdrop-blur-md border-l border-border">
      {/* Header */}
      <div className="h-10 px-4 flex items-center border-b border-border bg-card/50">
        <Sparkles className="w-4 h-4 text-accent mr-2" />
        <span className="text-sm font-display font-bold tracking-wider text-foreground">AI ASSISTANT</span>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2">
                <Bot className="w-8 h-8" />
                {ollamaAvailable ? (
                    <div className="text-sm text-center max-w-[200px]">
                        <p>Ollama Connected. Available models:</p>
                        <p className="font-mono text-xs">{ollamaModels.join(", ") || "None"}</p>
                        <p className="mt-2">Ready to assist with your code. Open a file to provide context.</p>
                    </div>
                ) : (
                    <div className="text-sm text-center max-w-[200px]">
                        <p>Ollama Not Connected.</p>
                        <p className="mt-2">Please ensure Ollama is running to use AI features.</p>
                    </div>
                )}
            </div>
        )}

        {messages.map((msg, i) => (
            <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                    "flex w-full",
                    msg.role === "user" ? "justify-end" : "justify-start"
                )}
            >
                <div className={cn(
                    "flex max-w-[85%] rounded-lg p-3 text-sm shadow-sm",
                    msg.role === "user" 
                        ? "bg-primary/10 text-primary-foreground border border-primary/20 rounded-tr-none" 
                        : "bg-card text-card-foreground border border-border rounded-tl-none"
                )}>
                    <div className="mr-3 mt-0.5 shrink-0 opacity-70">
                        {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">
                        {msg.content}
                    </div>
                </div>
            </motion.div>
        ))}

        {isLoading && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start w-full"
            >
                <div className="bg-card border border-border rounded-lg rounded-tl-none p-4 flex items-center space-x-2">
                    <Bot className="w-4 h-4 opacity-70 mr-2" />
                    <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-accent rounded-full animate-bounce"></div>
                    </div>
                </div>
            </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border bg-card/50">
        {activeFile && (
            <div className="mb-2 text-xs text-muted-foreground flex items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2 animate-pulse" />
                Context: {activeFile.split('/').pop()}
            </div>
        )}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            placeholder="Ask AI about your code..." 
            className="flex-1 bg-background/50 border-input focus:ring-accent/50 font-sans"
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={isLoading || !input.trim()}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
