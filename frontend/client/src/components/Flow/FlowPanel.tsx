import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Square, ListTodo, Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { flow } from '@/api/client';

export default function FlowPanel() {
  const [goal, setGoal] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [flowId, setFlowId] = useState<string | null>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("idle");
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleStartFlow = async () => {
    if (!goal.trim()) return;
    
    setIsExecuting(true);
    setStatus("starting");
    setSteps([]);
    setLogs(["Requesting flow start..."]);
    
    try {
      const response = await flow.start(goal);
      setFlowId(response.flow_id);
    } catch (error) {
      console.error("Failed to start flow:", error);
      setIsExecuting(false);
      setStatus("error");
      setLogs(prev => [...prev, "❌ Error starting flow."]);
    }
  };

  const handleStopFlow = () => {
    setIsExecuting(false);
    setFlowId(null);
    if (pollInterval.current) clearInterval(pollInterval.current);
  };

  useEffect(() => {
    if (flowId && isExecuting) {
      pollInterval.current = setInterval(async () => {
        try {
          const data = await flow.status(flowId);
          setSteps(data.steps || []);
          setLogs(data.logs || []);
          setStatus(data.status);
          
          if (data.status === 'completed' || data.status === 'error' || data.status === 'timeout') {
            setIsExecuting(false);
            if (pollInterval.current) clearInterval(pollInterval.current);
          }
        } catch (error) {
          console.error("Polling error:", error);
        }
      }, 2000);
    }
    
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [flowId, isExecuting]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="h-full flex flex-col bg-background/50 backdrop-blur-md">
      <div className="p-4 border-b border-border/50 bg-card/30">
        <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Autonomous Flow
        </h2>
        <p className="text-xs text-muted-foreground mt-1">AI Agent will plan and execute tasks autonomously.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-3">
          <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Goal</Label>
          <div className="flex gap-2">
            <Input 
                placeholder="e.g. 'Build a contact form with email validation'" 
                value={goal}
                onChange={e => setGoal(e.target.value)}
                disabled={isExecuting}
                className="bg-background/40 border-border/50"
            />
            {isExecuting ? (
                <Button variant="destructive" size="icon" onClick={handleStopFlow}>
                    <Square className="w-4 h-4" />
                </Button>
            ) : (
                <Button size="icon" onClick={handleStartFlow} disabled={!goal.trim()}>
                    <Play className="w-4 h-4" />
                </Button>
            )}
          </div>
        </div>

        {(isExecuting || status !== 'idle') && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                {steps.length > 0 && (
                    <div className="space-y-2">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Execution Progress</Label>
                        <div className="space-y-2">
                            {steps.map((step, idx) => (
                                <div key={step.id || idx} className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg border transition-all",
                                    step.status === 'completed' ? "bg-green-500/5 border-green-500/20" :
                                    "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.1)]"
                                )}>
                                    {step.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                                     <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                                    <span className={cn(
                                        "text-sm",
                                        step.status !== 'completed' ? "font-bold text-primary" : "text-foreground opacity-70"
                                    )}>{step.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Agent Logs</Label>
                    <div 
                        ref={scrollRef}
                        className="p-3 bg-black/40 rounded-lg border border-border/30 font-mono text-[10px] h-48 overflow-y-auto space-y-1"
                    >
                        {logs.map((log, idx) => (
                            <div key={idx} className={cn(
                                log.startsWith('🔧') ? "text-blue-400" :
                                log.startsWith('✅') || log.startswith('GOAL') ? "text-green-400" :
                                log.startsWith('❌') ? "text-red-400" :
                                "text-muted-foreground opacity-80"
                            )}>
                                {log}
                            </div>
                        ))}
                        {isExecuting && (
                            <div className="flex items-center gap-2 mt-2">
                                <Loader2 className="w-2 h-2 animate-spin text-primary" />
                                <span className="animate-pulse text-primary opacity-70">Agent is thinking...</span>
                            </div>
                        )}
                    </div>
                </div>

                {status === 'completed' && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2 text-green-500 text-xs">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Goal successfully achieved!</span>
                    </div>
                )}
                
                {(status === 'error' || status === 'timeout') && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-500 text-xs">
                        <AlertCircle className="w-4 h-4" />
                        <span>Flow halted: {status}</span>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("text-xs font-medium", className)}>{children}</div>;
}
