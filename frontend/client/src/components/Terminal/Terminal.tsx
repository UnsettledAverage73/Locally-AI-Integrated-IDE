import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Button } from '../ui/button';
import { RefreshCw, Sparkles } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { optimizer, fs } from '@/api/client';
import { toast } from '@/hooks/use-toast';

interface TerminalProps {
  className?: string;
}

interface ErrorDetails {
  filePath: string;
  lineNumber: number;
  errorMessage: string;
}

const FixItModal = ({ isOpen, onClose, errorDetails, diff, onAccept }: { isOpen: boolean, onClose: () => void, errorDetails: ErrorDetails | null, diff: string, onAccept: () => void }) => {
    if (!isOpen || !errorDetails) return null;

    return (
        <div className="absolute inset-0 z-20 bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-card border border-border rounded-lg shadow-xl w-3/4 max-w-4xl h-3/4 flex flex-col">
                <div className="p-4 border-b border-border">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-accent" /> Proposing a Fix</h2>
                    <p className="text-sm text-muted-foreground mt-1">File: <span className="font-mono">{errorDetails.filePath}</span> at line <span className="font-mono">{errorDetails.lineNumber}</span></p>
                </div>
                <div className="flex-1 p-4 overflow-y-auto font-mono text-sm bg-muted/20">
                    <pre>{diff}</pre>
                </div>
                <div className="p-4 border-t border-border flex justify-end gap-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button className="bg-green-600 hover:bg-green-700" onClick={onAccept}>Accept & Apply</Button>
                </div>
            </div>
        </div>
    );
};


const Terminal: React.FC<TerminalProps> = ({ className }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isTerminated, setIsTerminated] = useState(false);
  const [isFixItModalOpen, setIsFixItModalOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [fixDiff, setFixDiff] = useState("");
  const [fixedContent, setFixedContent] = useState("");

  // Function to establish (or re-establish) the WebSocket connection
  const connectTerminal = useCallback(() => {
    if (!xtermRef.current) return;
    const term = xtermRef.current;

    // Clean up existing connection if it exists
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
    }

    try {
        // Create new WebSocket connection to the backend PTY service
        const ws = new WebSocket('ws://localhost:8000/ws/terminal');
        wsRef.current = ws;

        ws.onopen = () => {
            setIsTerminated(false);
            term.write('\r\n\x1b[32m$ Connected to LocalDev Shell\x1b[0m\r\n');
            // Send initial resize command to match terminal dimensions
            const { cols, rows } = term;
            ws.send(`RESIZE:${cols},${rows}`);
        };

        ws.onmessage = (event) => {
            const output = event.data;
            term.write(output);
            
            // Naive error detection
            if (output.toLowerCase().includes("error")) {
                // This is a very basic example. A real implementation would need
                // more robust parsing of different error formats.
                const match = output.match(/File "(.+)", line (\d+)/);
                if (match) {
                    setErrorDetails({
                        filePath: match[1],
                        lineNumber: parseInt(match[2], 10),
                        errorMessage: output,
                    });
                }
            }
        };

        ws.onclose = () => {
            setIsTerminated(true);
            term.write('\r\n\x1b[31m$ Connection Closed\x1b[0m\r\n');
        };

        ws.onerror = (err) => {
            console.error("Terminal WebSocket error:", err);
            term.write('\r\n\x1b[31m$ Connection Error\x1b[0m\r\n');
            setIsTerminated(true);
        };
    } catch (e) {
        console.error("Failed to connect:", e);
        setIsTerminated(true);
    }
  }, []);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize xterm if not already initialized
    if (!xtermRef.current) {
        const term = new XTerm({
            cursorBlink: true,
            theme: {
                background: '#1e1e1e', // Matches VS Code Dark
                foreground: '#d4d4d4',
                cursor: '#ffffff',
            },
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 14,
            convertEol: true, // Helpful for some backends
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        
        // Initial fit
        setTimeout(() => {
            fitAddon.fit();
        }, 100);

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Handle terminal input
        term.onData((data) => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(data);
            }
        });
        
        // Handle terminal resize
        term.onResize((size) => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(`RESIZE:${size.cols},${size.rows}`);
            }
        });

        // Initial connection
        connectTerminal();
    }

    // Resize observer to auto-fit terminal on window resize
    const resizeObserver = new ResizeObserver(() => {
        // Debounce fit
        requestAnimationFrame(() => {
            fitAddonRef.current?.fit();
        });
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
      if (xtermRef.current) xtermRef.current.dispose();
      resizeObserver.disconnect();
    };
  }, [connectTerminal]);

  const handleRestart = () => {
      if (xtermRef.current) {
          xtermRef.current.reset();
      }
      connectTerminal();
  };

  const handleProposeFix = async () => {
      if (!errorDetails) return;
      setIsFixItModalOpen(true);
      try {
          const result = await optimizer.proposeFix(errorDetails.filePath, errorDetails.lineNumber, errorDetails.errorMessage);
          if (result.diff) {
              setFixDiff(result.diff);
              if (result.fixed_content) {
                  setFixedContent(result.fixed_content);
              }
          } else {
              toast({ title: "Fix-It Error", description: result.error || "Could not propose a fix.", variant: "destructive"});
              setIsFixItModalOpen(false);
          }
      } catch (e) {
          toast({ title: "API Error", description: "Failed to connect to the Fix-It service.", variant: "destructive"});
          setIsFixItModalOpen(false);
      }
  };
  
    const handleAcceptFix = async () => {
        if (!errorDetails || !fixedContent) return;
        
        try {
            await fs.writeFile(errorDetails.filePath, fixedContent);

            toast({title: "Fix applied!", className: "bg-green-500/10 border-green-500/50 text-green-500"});
            setIsFixItModalOpen(false);
            setErrorDetails(null);
            setFixDiff("");
            setFixedContent("");
        } catch (e) {
            toast({ title: "Apply Failed", description: "Could not write fix to file.", variant: "destructive"});
        }
    };

  return (
    <div className={`h-full w-full bg-[#1e1e1e] flex flex-col overflow-hidden relative ${className}`}>
        <div className="h-8 bg-card/80 border-b border-border flex items-center px-4 text-xs font-mono text-muted-foreground uppercase tracking-wider select-none justify-between">
            <span>Terminal</span>
            <div className='flex items-center gap-2'>
                {errorDetails && (
                    <Button variant="destructive" size="sm" className="h-6 gap-1.5" onClick={handleProposeFix}>
                        <Sparkles className="w-3 h-3" />
                        Fix It
                    </Button>
                )}
                {isTerminated && (
                    <span className="text-red-500 flex items-center gap-1">
                        ● Disconnected
                    </span>
                )}
            </div>
        </div>
        <div className="flex-1 p-2 overflow-hidden relative" ref={terminalRef}>
            {isTerminated && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <Button 
                        variant="secondary" 
                        onClick={handleRestart}
                        className="gap-2"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Restart Session
                    </Button>
                </div>
            )}
        </div>
        <FixItModal 
            isOpen={isFixItModalOpen}
            onClose={() => setIsFixItModalOpen(false)}
            errorDetails={errorDetails}
            diff={fixDiff}
            onAccept={handleAcceptFix}
        />
    </div>
  );
};

export default Terminal;
