import { useEffect, useRef } from 'react';
import { useChatStore } from '../store/useChatStore';
import { toast } from '@/hooks/use-toast';

export function useChatWebSocket() {
  const socketRef = useRef<WebSocket | null>(null);
  const { setChatMessages, currentSessionId, fetchChatSessions } = useChatStore();

  const connect = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket("ws://127.0.0.1:8000/ws/ollama/chat_v2");
    socketRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case "content_delta":
          useChatStore.setState(state => {
            const prev = state.chatMessages;
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              return { chatMessages: [...prev.slice(0, -1), { ...lastMsg, content: lastMsg.content + data.content }] };
            }
            return { chatMessages: [...prev, { role: 'assistant', content: data.content }] };
          });
          break;

        case "tool_calls":
          useChatStore.setState(state => ({
            chatMessages: [...state.chatMessages, { role: 'system', type: 'permission_request', content: 'Tool execution required', tool_calls: data.tool_calls }],
            isChatLoading: false
          }));
          break;
          
        case "complete":
          useChatStore.setState({ isChatLoading: false });
          window.dispatchEvent(new Event("llm-request-completed"));
          if (currentSessionId) fetchChatSessions();
          break;
          
        case "error":
          toast({ title: "AI Stream Error", description: data.error, variant: "destructive" });
          useChatStore.setState({ isChatLoading: false });
          break;
      }
    };

    ws.onclose = () => {
      console.log("Chat WebSocket disconnected. Reconnecting...");
      setTimeout(connect, 1000);
    };
  };

  useEffect(() => {
    connect();
    return () => socketRef.current?.close();
  }, []);

  const sendMessage = (content: string, model: string, sessionId: string | null) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: 'chat',
        model,
        messages: [{ role: 'user', content }],
        session_id: sessionId
      }));
      
      useChatStore.setState(state => ({
        chatMessages: [...state.chatMessages, { role: 'user', content }],
        isChatLoading: true
      }));
    } else {
      toast({ title: "Connection Error", description: "Chat service is not connected.", variant: "destructive" });
    }
  };

  return { sendMessage };
}
