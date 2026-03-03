import { useEffect, useRef } from 'react';
import { useFileStore } from '../store/useFileStore';
import { fs, rag } from '@/api/client';

export function useFileWatcher() {
  const socketRef = useRef<WebSocket | null>(null);
  const { rootPath, fetchFileTree } = useFileStore();

  const connect = () => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;

      const ws = new WebSocket("ws://127.0.0.1:8000/ws/files");
      socketRef.current = ws;

      ws.onmessage = async (event) => {
          try {
              const data = JSON.parse(event.data);
              if (data.type === "file_change") {
                  if (['created', 'deleted', 'moved'].includes(data.event)) {
                      fetchFileTree();
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
          console.log("File watcher disconnected. Reconnecting...");
          setTimeout(connect, 2000);
      };
  };

  useEffect(() => {
      connect();
      return () => socketRef.current?.close();
  }, [rootPath]);
}
