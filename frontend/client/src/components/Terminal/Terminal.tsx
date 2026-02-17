import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Button } from '../ui/button';
import { RefreshCw, Sparkles } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { optimizer, fs } from '@/api/client';
import { toast } from '@/hooks/use-toast';

interface TerminalProps {
  sessionId?: string;
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


export default function Terminal({ sessionId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isFixItModalOpen, setIsFixItModalOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [fixDiff, setFixDiff] = useState("");
  const [fixedContent, setFixedContent] = useState("");

  // Function to establish (or re-establish) the WebSocket connection
  const connectTerminal = useCallback(() => {
    if (!xtermRef.current || !sessionId) return;
    const term = xtermRef.current;

    // If connection exists and is valid, don't reconnect
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
        return;
    }

    // Clean up existing closed/closing connection
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
    }

    try {
        // Create new WebSocket connection to the backend PTY service
        const ws = new WebSocket(`ws://localhost:8000/ws/terminal/${sessionId}`);
        wsRef.current = ws;

        ws.onopen = () => {
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
            term.write('\r\n\x1b[31m$ Connection Closed. Reconnecting...\x1b[0m\r\n');
            setTimeout(connectTerminal, 1000); // Keep auto-reconnect
        };

        ws.onerror = (err) => {
            console.error("Terminal WebSocket error:", err);
            term.write('\r\n\x1b[31m$ Connection Error. Check backend.\x1b[0m\r\n');
        };
    } catch (e) {
        console.error("Failed to connect:", e);
    }
  }, [sessionId]);

  const hasInitialized = useRef(false);

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
    }

    // Only connect once
    if (!hasInitialized.current) {
        connectTerminal();
        hasInitialized.current = true;
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
      // Clean up only on component unmount
      if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
      }
      if (xtermRef.current) xtermRef.current.dispose();
      resizeObserver.disconnect();
      hasInitialized.current = false;
    };
  }, []); // Empty dependency array ensures this runs once on mount

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
    <div className={`h-full w-full bg-[#1e1e1e] flex flex-col overflow-hidden relative`}>
        <div className="h-8 bg-card/80 border-b border-border flex items-center px-4 text-xs font-mono text-muted-foreground uppercase tracking-wider select-none justify-between">
            <span>Terminal</span>
            <div className='flex items-center gap-2'>
                {errorDetails && (
                    <Button variant="destructive" size="sm" className="h-6 gap-1.5" onClick={handleProposeFix}>
                        <Sparkles className="w-3 h-3" />
                        Fix It
                    </Button>
                )}
            </div>
        </div>
        <div className="flex-1 p-2 overflow-hidden relative" ref={terminalRef}>
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
}
