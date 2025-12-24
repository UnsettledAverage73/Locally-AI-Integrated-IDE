import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Button } from '../ui/button';
import { RefreshCw } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  className?: string;
}

const Terminal: React.FC<TerminalProps> = ({ className }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isTerminated, setIsTerminated] = useState(false);

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
            term.write(event.data);
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

  return (
    <div className={`h-full w-full bg-[#1e1e1e] flex flex-col overflow-hidden relative ${className}`}>
        <div className="h-8 bg-card/80 border-b border-border flex items-center px-4 text-xs font-mono text-muted-foreground uppercase tracking-wider select-none justify-between">
            <span>Terminal</span>
            {isTerminated && (
                <span className="text-red-500 flex items-center gap-1">
                    ● Disconnected
                </span>
            )}
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
    </div>
  );
};

export default Terminal;
