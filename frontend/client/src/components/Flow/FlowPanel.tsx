import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Square, ListTodo, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FlowPanel() {
  const [goal, setGoal] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [steps, setSteps] = useState([
    { id: 1, title: "Initialize Architect", status: "completed" },
    { id: 2, title: "Plan Project Structure", status: "current" },
    { id: 3, title: "Generate Core Components", status: "pending" },
    { id: 4, title: "Verify via Terminal", status: "pending" },
  ]);

  const handleStartFlow = () => {
    setIsExecuting(true);
    // In real implementation, call flow_service.start_flow
  };

  const handleStopFlow = () => {
    setIsExecuting(false);
  };

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

        {isExecuting && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2">
                    <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-widest">Execution Progress</Label>
                    <div className="space-y-2">
                        {steps.map((step) => (
                            <div key={step.id} className={cn(
                                "flex items-center gap-3 p-3 rounded-lg border transition-all",
                                step.status === 'completed' ? "bg-green-500/5 border-green-500/20 opacity-60" :
                                step.status === 'current' ? "bg-primary/10 border-primary/30 shadow-[0_0_15px_rgba(var(--primary),0.1)]" :
                                "bg-card/20 border-border/20 opacity-40"
                            )}>
                                {step.status === 'completed' ? <CheckCircle2 className="w-4 h-4 text-green-500" /> :
                                 step.status === 'current' ? <Loader2 className="w-4 h-4 text-primary animate-spin" /> :
                                 <div className="w-4 h-4 rounded-full border-2 border-muted" />}
                                <span className={cn(
                                    "text-sm",
                                    step.status === 'current' ? "font-bold text-primary" : "text-foreground"
                                )}>{step.title}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-3 bg-black/40 rounded-lg border border-border/30 font-mono text-[10px] space-y-1">
                    <div className="text-blue-400">$ ls -R src/</div>
                    <div className="text-muted-foreground opacity-70">components/ utils/ App.tsx</div>
                    <div className="text-green-400">✓ Detected existing structure.</div>
                    <div className="text-blue-400">$ touch src/components/ContactForm.tsx</div>
                    <div className="flex items-center gap-2 mt-2">
                        <Loader2 className="w-2 h-2 animate-spin" />
                        <span className="animate-pulse">Writing component code...</span>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("text-xs font-medium", className)}>{children}</div>;
}
