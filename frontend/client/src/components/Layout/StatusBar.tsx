import { GitBranch, File, Loader2, CheckCircle, XCircle } from "lucide-react";
import { State } from '@/lib/language-client';

interface StatusBarProps {
    currentBranch: string;
    activeFile: string | null;
    isIndexing: boolean;
    lspStatus: State;
}

const StatusBar = ({ currentBranch, activeFile, isIndexing, lspStatus }: StatusBarProps) => {
    
    const lspStatusIndicator = () => {
        switch (lspStatus) {
            case State.Running:
                return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
            case State.Starting:
                return <Loader2 className="w-3.5 h-3.5 text-yellow-500 animate-spin" />;
            case State.Stopped:
                return <XCircle className="w-3.5 h-3.5 text-red-500" />;
        }
    };

    return (
        <footer className="h-6 border-t border-border bg-card text-xs flex items-center px-4 justify-between text-muted-foreground font-mono">
            <div className="flex items-center space-x-4">
                <div className="flex items-center gap-2">
                    <GitBranch className="w-3.5 h-3.5" />
                    <span className="text-primary">{currentBranch}</span>
                </div>
                <div className="flex items-center gap-2">
                    {lspStatusIndicator()}
                    <span>LSP</span>
                </div>
                {isIndexing && (
                    <div className="flex items-center gap-2 animate-pulse">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Indexing...</span>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-4">
                {activeFile && <File className="w-3.5 h-3.5" />}
                <span>{activeFile ? activeFile.split('/').pop() : "No File"}</span>
                <span>UTF-8</span>
            </div>
        </footer>
    );
};

export default StatusBar;
