import { Loader2 } from "lucide-react";
import React from "react";

const BootScreen = () => {
    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-primary">
            <div className="flex flex-col items-center">
                <h1 className="text-5xl font-bold font-display tracking-widest mb-4">
                    AVERAGE
                </h1>
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
                <p className="font-mono animate-pulse">INITIALIZING AVERAGE ENV...</p>
                <div className="mt-8 text-sm text-muted-foreground font-mono text-center">
                    <p>Fetching file system...</p>
                    <p>Connecting to AI service...</p>
                    <p>Warming up models...</p>
                </div>
            </div>
        </div>
    );
};

export default BootScreen;
