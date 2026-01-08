import { Button } from "@/components/ui/button";
import { Command, FilePlus, FolderOpen } from "lucide-react";
import React from "react";

interface WelcomeProps {
    onOpenFolder: () => void;
    onOpenFile: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({ onOpenFolder, onOpenFile }) => {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-card text-card-foreground p-8 select-none">
            <div className="text-center">
                <h1 className="text-4xl font-bold font-display tracking-widest mb-2">
                    AVERAGE
                </h1>
                <p className="text-muted-foreground mb-8">
                    Your local-first, privacy-focused AI development environment.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                        onClick={onOpenFolder}
                        variant="outline"
                        className="w-full sm:w-auto"
                    >
                        <FolderOpen className="w-4 h-4 mr-2" />
                        Open Folder
                    </Button>
                    <Button
                        onClick={onOpenFile}
                        variant="outline"
                        className="w-full sm:w-auto"
                    >
                        <FilePlus className="w-4 h-4 mr-2" />
                        Open File
                    </Button>
                </div>

                <div className="mt-12 text-sm text-muted-foreground">
                    <p className="flex items-center justify-center">
                        <span className="font-mono bg-muted px-2 py-1 rounded-md mr-2">
                           ⌘ + P
                        </span>
                        to open the command palette.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Welcome;
