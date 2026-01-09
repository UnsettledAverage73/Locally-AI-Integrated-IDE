import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search as SearchIcon, FileText, File } from "lucide-react";
import { search } from "@/api/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SearchPanelProps {
    onFileClick: (path: string) => void;
}

const SearchPanel: React.FC<SearchPanelProps> = ({ onFileClick }) => {
    const { toast } = useToast();
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<string[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [mode, setMode] = useState<'filenames' | 'text'>('text');

    const handleSearch = async () => {
        if (!query.trim()) return;

        setIsSearching(true);
        setResults([]);

        try {
            const data = mode === 'filenames' 
                ? await search.searchFilenames(query)
                : await search.searchText(query);
            
            if (data.results.startsWith("No files found") || data.results.startsWith("No matches found")) {
                setResults([]);
                toast({ title: "No results found" });
            } else {
                setResults(data.results.split("\n"));
            }
        } catch (error) {
            toast({
                title: "Search Failed",
                description: "Could not execute search.",
                variant: "destructive",
            });
        } finally {
            setIsSearching(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="p-2 border-b border-border/50">
                <div className="flex items-center justify-between mb-2">
                     <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Search</span>
                     <div className="flex bg-muted rounded-md p-0.5">
                        <button
                            onClick={() => setMode('text')}
                            className={cn(
                                "p-1 rounded text-xs transition-all",
                                mode === 'text' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                            title="Find in Files"
                        >
                            <FileText className="w-3 h-3" />
                        </button>
                        <button
                            onClick={() => setMode('filenames')}
                            className={cn(
                                "p-1 rounded text-xs transition-all",
                                mode === 'filenames' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                            title="Find Files by Name"
                        >
                            <File className="w-3 h-3" />
                        </button>
                     </div>
                </div>
                <div className="relative">
                    <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={mode === 'text' ? "Search text..." : "Search filenames (e.g. *.py)"}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="pl-8 h-9 text-xs"
                    />
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
                {isSearching ? (
                    <div className="text-xs text-center text-muted-foreground mt-4">Searching...</div>
                ) : results.length > 0 ? (
                    <div className="space-y-1">
                        {results.map((line, i) => {
                            // Parse result line
                            // For filenames: "path/to/file"
                            // For text: "path/to/file:line: content"
                            let displayPath = line;
                            let content = "";
                            let lineNum = "";

                            if (mode === 'text' && line.includes(":")) {
                                const parts = line.split(":", 3);
                                if (parts.length >= 3) {
                                    displayPath = parts[0];
                                    lineNum = parts[1];
                                    content = line.substring(parts[0].length + parts[1].length + 2).trim();
                                }
                            }

                            return (
                                <div 
                                    key={i} 
                                    className="group flex flex-col gap-0.5 p-2 rounded hover:bg-accent hover:text-accent-foreground cursor-pointer text-xs"
                                    onClick={() => onFileClick(displayPath)}
                                >
                                    <div className="font-medium truncate flex items-center gap-2">
                                        <File className="w-3 h-3 opacity-70" />
                                        <span className="truncate" title={displayPath}>{displayPath}</span>
                                        {lineNum && <span className="text-muted-foreground ml-auto opacity-0 group-hover:opacity-100">:{lineNum}</span>}
                                    </div>
                                    {content && (
                                        <div className="text-muted-foreground truncate pl-5 opacity-80">
                                            {content}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                     <div className="h-full flex flex-col items-center justify-center p-4 text-center opacity-50">
                        <SearchIcon className="w-8 h-8 mb-2" />
                        <p className="text-xs">Type query and press Enter</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SearchPanel;
