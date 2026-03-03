import React, { useState, useEffect } from "react";
import { FileEntry } from "@/types";
import { 
    Folder, File as FileIcon, ChevronRight, ChevronLeft, 
    Home, Grid, List as ListIcon, Search, ArrowUp, RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { fs } from "@/api/client";
import { motion, AnimatePresence } from "framer-motion";

interface FileManagerProps {
    initialPath?: string;
    onFileOpen: (path: string) => void;
}

export default function FileManager({ initialPath = ".", onFileOpen }: FileManagerProps) {
    const { toast } = useToast();
    const [currentPath, setCurrentPath] = useState(initialPath);
    const [history, setHistory] = useState<string[]>([initialPath]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [items, setItems] = useState<FileEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    // Fetch directory contents
    const loadDirectory = async (path: string) => {
        setLoading(true);
        try {
            const data = await fs.readDirectory(path);
            // Sort: Directories first, then files
            const sorted = data.entries.sort((a, b) => {
                if (a.isDirectory === b.isDirectory) {
                    return a.name.localeCompare(b.name);
                }
                return a.isDirectory ? -1 : 1;
            });
            setItems(sorted);
            // Update history only if it's a new path (not back/forward)
            if (path !== history[historyIndex]) {
                 // Logic handled in navigation handlers
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load directory.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDirectory(currentPath);
    }, [currentPath]);

    const handleNavigate = (path: string) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(path);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setCurrentPath(path);
        setSelectedItem(null);
    };

    const handleBack = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setCurrentPath(history[newIndex]);
        }
    };

    const handleForward = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setCurrentPath(history[newIndex]);
        }
    };

    const handleUp = () => {
        if (currentPath === "." || currentPath === "/") return;
        // Simple parent resolution
        const parts = currentPath.split("/");
        parts.pop();
        const parent = parts.length === 0 || (parts.length === 1 && parts[0] === "") ? "/" : parts.join("/");
        handleNavigate(parent || ".");
    };

    const handleItemClick = (item: FileEntry) => {
        if (selectedItem === item.path) {
            // Double click logic
            if (item.isDirectory) {
                handleNavigate(item.path);
            } else {
                onFileOpen(item.path);
            }
        } else {
            setSelectedItem(item.path);
        }
    };

    const filteredItems = items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-background text-foreground select-none">
            {/* Toolbar */}
            <div className="flex items-center gap-2 p-2 border-b border-border bg-card/50 backdrop-blur-sm">
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={handleBack} disabled={historyIndex === 0} className="h-8 w-8">
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleForward} disabled={historyIndex === history.length - 1} className="h-8 w-8">
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleUp} className="h-8 w-8" title="Up one level">
                        <ArrowUp className="w-4 h-4" />
                    </Button>
                </div>

                {/* Address Bar */}
                <div className="flex-1 flex items-center bg-muted/50 rounded-md px-2 h-8 border border-border/50 focus-within:border-primary transition-colors">
                    <Home className="w-4 h-4 text-muted-foreground mr-2 cursor-pointer hover:text-foreground" onClick={() => handleNavigate(".")} />
                    <span className="text-muted-foreground mr-1">/</span>
                    <input 
                        className="bg-transparent border-none outline-none text-sm w-full"
                        value={currentPath}
                        onChange={(e) => setCurrentPath(e.target.value)} // Just visual editing for now
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleNavigate(currentPath);
                        }}
                    />
                </div>

                <div className="flex gap-1">
                     <div className="relative">
                        <Search className="absolute left-2 top-1.5 w-4 h-4 text-muted-foreground" />
                        <Input 
                            className="h-8 pl-8 w-40 transition-all focus:w-60" 
                            placeholder="Filter..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                     </div>
                     <div className="flex bg-muted rounded-md p-0.5 ml-2">
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn("h-7 w-7 rounded-sm", viewMode === 'grid' && "bg-background shadow")} 
                            onClick={() => setViewMode('grid')}
                        >
                            <Grid className="w-4 h-4" />
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className={cn("h-7 w-7 rounded-sm", viewMode === 'list' && "bg-background shadow")} 
                            onClick={() => setViewMode('list')}
                        >
                            <ListIcon className="w-4 h-4" />
                        </Button>
                     </div>
                </div>
            </div>

            {/* Content Area */}
            <ScrollArea className="flex-1 p-4" onClick={() => setSelectedItem(null)}>
                {loading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground animate-pulse">
                        <RefreshCw className="w-8 h-8 animate-spin mr-2" />
                        Loading...
                    </div>
                ) : (
                    <div className={cn(
                        "grid gap-4",
                        viewMode === 'grid' ? "grid-cols-[repeat(auto-fill,minmax(100px,1fr))]" : "grid-cols-1"
                    )}>
                        <AnimatePresence>
                        {filteredItems.map((item) => (
                            <motion.div
                                key={item.path}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                transition={{ duration: 0.2 }}
                                onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
                                className={cn(
                                    "group relative rounded-lg border border-transparent p-3 cursor-pointer transition-all hover:bg-accent/50",
                                    selectedItem === item.path && "bg-accent border-primary/30 ring-1 ring-primary/20",
                                    viewMode === 'list' ? "flex items-center gap-4 h-12" : "flex flex-col items-center gap-2 aspect-square justify-center"
                                )}
                                draggable
                                onDragStart={(e: any) => {
                                    if (e.dataTransfer) {
                                        e.dataTransfer.setData("text/plain", item.path);
                                    }
                                }}
                            >
                                <div className={cn(
                                    "text-primary/80 transition-transform group-hover:scale-110 duration-200",
                                    item.isDirectory ? "text-blue-400" : "text-gray-400"
                                )}>
                                    {item.isDirectory ? (
                                        <Folder className={cn("fill-current", viewMode === 'grid' ? "w-12 h-12" : "w-6 h-6")} />
                                    ) : (
                                        <FileIcon className={cn("fill-current opacity-70", viewMode === 'grid' ? "w-10 h-10" : "w-5 h-5")} />
                                    )}
                                </div>
                                
                                <span className={cn(
                                    "text-sm font-medium text-center truncate w-full px-1 rounded",
                                    selectedItem === item.path ? "text-accent-foreground" : "text-muted-foreground group-hover:text-foreground",
                                    viewMode === 'list' && "text-left"
                                )}>
                                    {item.name}
                                </span>

                                {/* Preview / Info Tooltip (Simple version) */}
                                {viewMode === 'list' && !item.isDirectory && (
                                    <div className="ml-auto text-xs text-muted-foreground/50">
                                        File
                                    </div>
                                )}
                            </motion.div>
                        ))}
                        </AnimatePresence>
                        {filteredItems.length === 0 && (
                            <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground opacity-50">
                                <Folder className="w-16 h-16 mb-4" />
                                <p>This folder is empty</p>
                            </div>
                        )}
                    </div>
                )}
            </ScrollArea>
            
            {/* Status Footer */}
            <div className="bg-card border-t border-border px-4 py-1 text-xs text-muted-foreground flex justify-between">
                <span>{filteredItems.length} items</span>
                <span>{selectedItem ? `Selected: ${selectedItem.split('/').pop()}` : "No selection"}</span>
            </div>
        </div>
    );
}
