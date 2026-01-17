import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PlusIcon, XIcon } from 'lucide-react';
import Terminal from './Terminal';
import { apiClient } from '../../api/client';

export default function TerminalManager() {
    const [sessions, setSessions] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<string>('');

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
    }, []);

    useEffect(() => {
        // Create an initial terminal on mount
        createNewTerminal();
    }, [createNewTerminal]);

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
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-5 h-5 ml-2 hover:bg-red-500/10"
                                    onClick={(e) => closeTab(e, id)}
                                >
                                    <XIcon className="w-3 h-3" />
                                </Button>
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
