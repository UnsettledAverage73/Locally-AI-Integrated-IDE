interface StatusBarProps {
    currentBranch: string;
    activeFile: string | null;
}

const StatusBar = ({ currentBranch, activeFile }: StatusBarProps) => {
    return (
        <footer className="h-6 border-t border-border bg-card text-xs flex items-center px-4 justify-between text-muted-foreground font-mono">
            <div className="flex space-x-4">
                <span>Branch: <span className="text-primary">{currentBranch}</span></span>
                <span>Errors: 0</span>
            </div>
            <div>
                {activeFile ? "UTF-8" : "No File"}
            </div>
        </footer>
    );
};

export default StatusBar;
