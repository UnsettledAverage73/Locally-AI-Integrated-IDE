import React, { useEffect, useState } from "react";
import { GitBranch, Check, Plus, Minus, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { git } from "@/api/client";
import { Loader2 } from "lucide-react";

interface GitChange {
    code: string;
    path: string;
}

export default function SourceControl() {
    const [changes, setChanges] = useState<GitChange[]>([]);
    const [message, setMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const { toast } = useToast();

    const fetchStatus = async () => {
        setIsLoading(true);
        try {
            const { changes } = await git.status();
            setChanges(changes);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStatus();
    }, []);

    const handleStage = async (path: string) => {
        await git.stage(path);
        fetchStatus();
    };

    const handleUnstage = async (path: string) => {
        await git.unstage(path);
        fetchStatus();
    };

    const handleGenerateMessage = async () => {
        setIsGenerating(true);
        try {
            const { message } = await git.generateMessage();
            setMessage(message);
        } catch (error) {
            toast({
                title: "Generation Failed",
                description: "Could not generate commit message.",
                variant: "destructive",
            });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCommit = async () => {
        if (!message) return;
        try {
            await git.commit(message);
            setMessage("");
            fetchStatus();
            toast({
                title: "Commit Successful",
                description: "Changes committed to repository.",
                className: "bg-green-500/10 border-green-500/50 text-green-500",
            });
        } catch (error) {
            toast({
                title: "Commit Failed",
                description: "Could not commit changes.",
                variant: "destructive",
            });
        }
    };

    const stagedChanges = changes.filter(c => c.code[0] !== ' ' && c.code[0] !== '?');
    const unstagedChanges = changes.filter(c => c.code[0] === ' ' || c.code[0] === '?');

    return (
        <div className="h-full flex flex-col bg-card/20 text-sm">
            <div className="p-2 border-b border-border/50 flex items-center justify-between">
                <span className="font-bold text-muted-foreground uppercase tracking-wider text-xs">Source Control</span>
                <Button variant="ghost" size="icon" onClick={fetchStatus} className="h-6 w-6">
                    <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-4">
                {/* Commit Message Area */}
                <div className="space-y-2">
                    <div className="flex gap-2">
                        <Textarea 
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Message (Cmd+Enter to commit)"
                            className="min-h-[80px] font-mono text-xs resize-none bg-background/50"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button 
                            variant="secondary" 
                            size="sm" 
                            className="flex-1 text-xs h-8"
                            onClick={handleGenerateMessage}
                            disabled={isGenerating}
                        >
                            {isGenerating ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <SparklesIcon className="w-3 h-3 mr-2" />}
                            Generate AI Message
                        </Button>
                        <Button 
                            size="sm" 
                            className="flex-1 text-xs h-8"
                            onClick={handleCommit}
                            disabled={!message || stagedChanges.length === 0}
                        >
                            <Check className="w-3 h-3 mr-2" />
                            Commit
                        </Button>
                    </div>
                </div>

                {/* Staged Changes */}
                <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                        <span>STAGED CHANGES ({stagedChanges.length})</span>
                    </div>
                    <div className="space-y-1">
                        {stagedChanges.map((file) => (
                            <div key={file.path} className="flex items-center justify-between group px-2 py-1 hover:bg-accent/50 rounded cursor-pointer">
                                <span className="truncate flex-1" title={file.path}>{file.path}</span>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100"
                                    onClick={() => handleUnstage(file.path)}
                                >
                                    <Minus className="w-3 h-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Changes */}
                <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                        <span>CHANGES ({unstagedChanges.length})</span>
                    </div>
                    <div className="space-y-1">
                        {unstagedChanges.map((file) => (
                            <div key={file.path} className="flex items-center justify-between group px-2 py-1 hover:bg-accent/50 rounded cursor-pointer">
                                <span className="truncate flex-1" title={file.path}>{file.path}</span>
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground font-mono w-4 text-center">{file.code}</span>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-5 w-5 opacity-0 group-hover:opacity-100"
                                        onClick={() => handleStage(file.path)}
                                    >
                                        <Plus className="w-3 h-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SparklesIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            <path d="M5 3v4" />
            <path d="M9 5h4" />
            <path d="M19 19v2" />
            <path d="M17 21h4" />
        </svg>
    )
}
