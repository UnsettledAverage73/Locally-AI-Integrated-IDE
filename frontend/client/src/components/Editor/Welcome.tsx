import { Button } from "@/components/ui/button";
import { Command, FilePlus, FolderOpen, Clock, File } from "lucide-react";
import React from "react";
import { motion } from "framer-motion";

interface WelcomeProps {
    onOpenFolder: () => void;
    onOpenFile: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onOpenFolder, onOpenFile }) => {
    // Mock recent projects for visual demonstration
    const recentProjects = [
        { name: "my-awesome-project", path: "~/dev/my-awesome-project", date: "2 hours ago" },
        { name: "react-ui-kit", path: "~/dev/react-ui-kit", date: "Yesterday" },
        { name: "backend-api", path: "~/work/backend-api", date: "2 days ago" },
    ];

    return (
        <div className="h-full flex flex-col items-center justify-center bg-background text-foreground p-8 select-none">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-2xl"
            >
                <div className="text-center mb-12">
                    <h1 className="text-5xl font-bold font-display tracking-widest mb-4 bg-gradient-to-r from-accent to-purple-500 bg-clip-text text-transparent">
                        AVERAGE
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Local-first, privacy-focused AI development environment.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Actions */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Start</h2>
                        <div className="space-y-3">
                            <Button
                                onClick={onOpenFolder}
                                variant="outline"
                                className="w-full justify-start h-12 text-base hover:border-accent hover:text-accent transition-all group"
                            >
                                <FolderOpen className="w-5 h-5 mr-3 text-muted-foreground group-hover:text-accent" />
                                <div className="flex flex-col items-start">
                                    <span>Open Folder</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">Navigate to an existing project</span>
                                </div>
                            </Button>
                            <Button
                                onClick={onOpenFile}
                                variant="outline"
                                className="w-full justify-start h-12 text-base hover:border-accent hover:text-accent transition-all group"
                            >
                                <FilePlus className="w-5 h-5 mr-3 text-muted-foreground group-hover:text-accent" />
                                <div className="flex flex-col items-start">
                                    <span>Open File</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">Edit a single file</span>
                                </div>
                            </Button>
                        </div>
                    </div>

                    {/* Recent */}
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Recent</h2>
                        <div className="space-y-2">
                            {recentProjects.map((project, i) => (
                                <button 
                                    key={i}
                                    className="w-full flex items-center p-2 rounded-md hover:bg-accent/10 hover:text-accent transition-colors text-left group"
                                >
                                    <Clock className="w-4 h-4 mr-3 text-muted-foreground group-hover:text-accent" />
                                    <div className="flex-1 overflow-hidden">
                                        <div className="font-medium text-sm truncate">{project.name}</div>
                                        <div className="text-xs text-muted-foreground truncate">{project.path}</div>
                                    </div>
                                    <span className="text-xs text-muted-foreground/50 whitespace-nowrap ml-2">{project.date}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="mt-16 text-center">
                    <div className="inline-flex items-center gap-6 text-sm text-muted-foreground bg-muted/30 px-6 py-2 rounded-full border border-border/50">
                        <p className="flex items-center">
                            <span className="font-mono bg-background border border-border px-1.5 py-0.5 rounded text-xs mr-2 shadow-sm">
                               ⌘ P
                            </span>
                            Command Palette
                        </p>
                        <span className="w-1 h-1 rounded-full bg-border" />
                        <p className="flex items-center">
                            <span className="font-mono bg-background border border-border px-1.5 py-0.5 rounded text-xs mr-2 shadow-sm">
                               Ctrl J
                            </span>
                            Toggle Terminal
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Welcome;
