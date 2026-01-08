import { Button } from "@/components/ui/button";
import { Command, Settings } from "lucide-react";

interface HeaderProps {
    onSettingsClick: () => void;
}

const Header = ({ onSettingsClick }: HeaderProps) => {
    return (
        <header className="h-10 border-b border-border bg-card/50 backdrop-blur flex items-center px-4 justify-between select-none">
            <div className="flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                <div className="w-3 h-3 rounded-full bg-green-500/50" />
                <span className="ml-4 font-display font-bold text-lg tracking-widest text-foreground/80">AVERAGE</span>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={onSettingsClick} className="h-8 w-8 hover:bg-muted">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                </Button>
                <div className="flex items-center text-xs text-muted-foreground font-mono bg-black/20 px-2 py-1 rounded">
                    <Command className="w-3 h-3 mr-2" />
                    v1.0.0-alpha
                </div>
            </div>
        </header>
    );
};

export default Header;
