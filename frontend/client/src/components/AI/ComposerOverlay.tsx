import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, X, FileCode, ArrowRight, Eye, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComposerOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    changes: { path: string; original: string; modified: string }[];
    onApply: (paths: string[]) => void;
}

export default function ComposerOverlay({ isOpen, onClose, changes, onApply }: ComposerOverlayProps) {
    const [selectedPaths, setSelectedPaths] = useState<string[]>(changes.map(c => c.path));

    if (!isOpen || changes.length === 0) return null;

    const togglePath = (path: string) => {
        setSelectedPaths(prev => 
            prev.includes(path) ? prev.filter(p => p !== path) : [...prev, path]
        );
    };

    return (
        <div className="absolute inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-card border border-border shadow-2xl rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden ring-1 ring-white/10">
                <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded bg-primary/20 text-primary">
                            <Layers className="w-4 h-4" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold">Architect Composer</h2>
                            <p className="text-[10px] text-muted-foreground">Proposing changes to {changes.length} files</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
                        <X className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {changes.map((change) => {
                        const isSelected = selectedPaths.includes(change.path);
                        return (
                            <div 
                                key={change.path} 
                                className={cn(
                                    "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                                    isSelected ? "bg-accent/10 border-primary/40 ring-1 ring-primary/20" : "bg-muted/10 border-border/40 opacity-60"
                                )}
                                onClick={() => togglePath(change.path)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                        isSelected ? "bg-primary border-primary" : "border-muted-foreground/30"
                                    )}>
                                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                                    </div>
                                    <FileCode className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-xs font-mono truncate max-w-[300px]">{change.path}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 text-[10px] gap-1 hover:bg-white/5"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // TODO: Preview single file diff
                                        }}
                                    >
                                        <Eye className="w-3 h-3" />
                                        Diff
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="p-4 border-t border-border bg-muted/10 flex justify-end gap-2">
                    <Button variant="ghost" onClick={onClose} className="text-xs h-9">Discard All</Button>
                    <Button 
                        onClick={() => onApply(selectedPaths)} 
                        disabled={selectedPaths.length === 0}
                        className="text-xs h-9 bg-primary text-primary-foreground shadow-lg shadow-primary/20 gap-2 px-6"
                    >
                        Apply {selectedPaths.length} Changes
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
