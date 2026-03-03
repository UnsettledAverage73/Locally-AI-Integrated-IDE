import { Button } from "@/components/ui/button";
import { Command, Settings, ChevronRight, LayoutGrid, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderProps {
    onToggleSidebar: () => void;
    onTogglePanel: () => void;
    isSidebarVisible: boolean;
    isPanelVisible: boolean;
    onSettingsClick: () => void;
}

const Header = ({ 
    onToggleSidebar, 
    onTogglePanel, 
    isSidebarVisible, 
    isPanelVisible, 
    onSettingsClick 
}: HeaderProps) => {
    return (
        <header className="h-10 border-b border-border bg-background/95 backdrop-blur flex items-center px-4 justify-between select-none z-50">
            {/* Window Controls / Branding */}
            <div className="flex items-center space-x-4">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onToggleSidebar} 
                    className={cn("h-7 w-7 transition-colors", !isSidebarVisible ? "text-muted-foreground" : "text-primary")}
                    title="Toggle Sidebar"
                >
                    <LayoutGrid className="w-4 h-4" />
                </Button>

                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onTogglePanel} 
                    className={cn("h-7 w-7 transition-colors", !isPanelVisible ? "text-muted-foreground" : "text-primary")}
                    title="Toggle Bottom Panel"
                >
                    <Terminal className="w-4 h-4" />
                </Button>
                
                <div className="h-4 w-[1px] bg-border mx-2" />
                
                <div className="flex items-center text-sm font-medium text-foreground/80">
                    <span className="font-display font-bold tracking-wider">AVERAGE</span>
                </div>
            </div>

            {/* Center Search / Command Trigger */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 max-w-md hidden md:block">
                <div className="bg-muted/30 border border-border/50 rounded-md px-3 py-1.5 flex items-center justify-between text-xs text-muted-foreground cursor-default hover:bg-muted/50 hover:border-border transition-all">
                     <span className="flex items-center">
                        <Command className="w-3 h-3 mr-2 opacity-50" />
                        Search files and commands...
                     </span>
                     <span className="flex items-center gap-1 opacity-50 font-mono text-[10px]">
                        <span className="bg-background px-1 rounded border border-border">⌘</span>
                        <span className="bg-background px-1 rounded border border-border">P</span>
                     </span>
                </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
                 <div className="hidden sm:flex items-center text-[10px] text-muted-foreground bg-accent/5 px-2 py-1 rounded-full border border-accent/10">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse" />
                    v1.0.0
                </div>
                <Button variant="ghost" size="icon" onClick={onSettingsClick} className="h-8 w-8 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <Settings className="w-4 h-4" />
                </Button>
            </div>
        </header>
    );
};

export default Header;
