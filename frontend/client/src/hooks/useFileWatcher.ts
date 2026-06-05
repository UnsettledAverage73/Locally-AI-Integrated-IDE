import { useEffect, useRef } from 'react';
import { useFileStore } from '../store/useFileStore';
import { fs, rag } from '@/api/client';

export function useFileWatcher() {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const fetchFileTreeRef = useRef<(() => Promise<void>) | null>(null);
  const { fetchFileTree } = useFileStore();

  useEffect(() => {
    fetchFileTreeRef.current = fetchFileTree;
  }, [fetchFileTree]);

  const connect = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;
      if (!mountedRef.current) return;

      const ws = new WebSocket("ws://127.0.0.1:8000/ws/files");
      socketRef.current = ws;

      ws.onmessage = async (event) => {
          try {
              const data = JSON.parse(event.data);
              if (data.type === "file_change") {
                  if (['created', 'deleted', 'moved'].includes(data.event)) {
                      fetchFileTreeRef.current?.();
                  }

                  if (data.event === 'modified' || data.event === 'created') {
                      if (data.path && !data.isDirectory) {
                          try {
                              const { content } = await fs.readFile(data.path);
                              await rag.indexFile(data.path, content);
                          } catch (e) {
                              console.error(`Auto-index failed for ${data.path}:`, e);
                          }
                      }
                  }
              }
          } catch (e) {
              console.error("File watcher message error:", e);
          }
      };

      ws.onclose = () => {
          if (!mountedRef.current) return;
          console.log("File watcher disconnected. Reconnecting...");
          if (reconnectTimerRef.current) {
              window.clearTimeout(reconnectTimerRef.current);
          }
          reconnectTimerRef.current = window.setTimeout(connect, 2000);
      };
  };

  useEffect(() => {
      mountedRef.current = true;
      connect();
      return () => {
          mountedRef.current = false;
          if (reconnectTimerRef.current) {
              window.clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
          }
          socketRef.current?.close();
      };
  }, []);
}
