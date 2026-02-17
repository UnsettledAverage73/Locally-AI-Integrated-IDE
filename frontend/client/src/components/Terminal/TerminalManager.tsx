import React, { useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlusIcon, XIcon } from 'lucide-react';
import Terminal from './Terminal';
import { apiClient } from '../../api/client';

interface TerminalManagerProps {
    sessions: string[];
    setSessions: React.Dispatch<React.SetStateAction<string[]>>;
    activeTab: string;
    setActiveTab: React.Dispatch<React.SetStateAction<string>>;
}

export default function TerminalManager({ sessions, setSessions, activeTab, setActiveTab }: TerminalManagerProps) {
    const createNewTerminal = useCallback(async () => {
        try {
            const response = await apiClient.post('/terminals');
            const { session_id } = response.data;
            setSessions(prev => [...prev, session_id]);
            setActiveTab(session_id);
        } catch (error) {
            console.error("Failed to create new terminal session:", error);
            // You might want to show a toast notification here
        }
    }, [setSessions, setActiveTab]);

    const closeTab = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        setSessions(prev => {
            const newSessions = prev.filter(s => s !== sessionId);
            if (activeTab === sessionId) {
                setActiveTab(newSessions[0] || '');
            }
            return newSessions;
        });
        // Note: The backend will automatically clean up the session when the websocket disconnects.
    };

    return (
        <div className="h-full flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <div className="flex items-center border-b border-border">
                    <TabsList className="bg-transparent border-none rounded-none p-0">
                        {sessions.map((id, index) => (
                            <TabsTrigger key={id} value={id} className="text-xs h-10 border-r border-transparent">
                                <span>Terminal {index + 1}</span>
                                <span
                                    className="w-5 h-5 ml-2 rounded-sm inline-flex items-center justify-center hover:bg-muted"
                                    onClick={(e) => closeTab(e, id)}
                                >
                                    <XIcon className="w-3 h-3" />
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    <Button variant="ghost" size="icon" className="h-7 w-7 ml-2" onClick={createNewTerminal}>
                        <PlusIcon className="w-4 h-4" />
                    </Button>
                </div>
                {sessions.map(id => (
                    <TabsContent key={id} value={id} className="flex-1 h-full overflow-hidden">
                       <Terminal sessionId={id} />
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
