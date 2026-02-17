import React from "react";
import { MessageSquare, Clock, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ChatSession {
  id: string;
  title: string;
  updated_at: string;
  model: string;
}

interface ChatHistoryProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => void;
}

export default function ChatHistory({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
}: ChatHistoryProps) {
  return (
    <div className="flex flex-col h-full bg-card/20 border-r border-border/50">
      <div className="p-3 border-b border-border/50">
        <Button 
          onClick={onNewChat}
          className="w-full justify-start gap-2 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30 text-center p-4">
            <MessageSquare className="w-8 h-8 mb-2" />
            <p className="text-xs">No chat history yet</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={cn(
                "group relative flex flex-col p-2.5 rounded-lg cursor-pointer transition-all border border-transparent",
                currentSessionId === session.id 
                  ? "bg-accent/15 border-accent/30 text-accent" 
                  : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium truncate flex-1">
                  {session.title || "Untitled Chat"}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              
              <div className="flex items-center gap-2 mt-1.5 opacity-50 text-[10px]">
                <Clock className="w-2.5 h-2.5" />
                <span>{formatDistanceToNow(new Date(session.updated_at))} ago</span>
                <span className="px-1.5 py-0.5 rounded-full bg-background/50 border border-border/50 uppercase tracking-tighter">
                  {session.model.split(":")[0]}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
