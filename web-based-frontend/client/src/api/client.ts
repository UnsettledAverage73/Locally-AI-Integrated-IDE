import axios from "axios";
import { FileEntry, FileContent, ChatMessage, ChatResponse } from "../types";

// Mock data for development without backend
const MOCK_FILE_TREE: FileEntry[] = [
  {
    name: "src",
    path: "/src",
    isDirectory: true,
    children: [
      { name: "App.tsx", path: "/src/App.tsx", isDirectory: false },
      { name: "main.tsx", path: "/src/main.tsx", isDirectory: false },
      { name: "utils.ts", path: "/src/utils.ts", isDirectory: false },
      { 
        name: "components", 
        path: "/src/components", 
        isDirectory: true, 
        children: [
            { name: "Header.tsx", path: "/src/components/Header.tsx", isDirectory: false },
            { name: "Footer.tsx", path: "/src/components/Footer.tsx", isDirectory: false }
        ] 
      }
    ]
  },
  { name: "package.json", path: "/package.json", isDirectory: false },
  { name: "tsconfig.json", path: "/tsconfig.json", isDirectory: false },
  { name: "README.md", path: "/README.md", isDirectory: false },
];

const MOCK_FILES: Record<string, string> = {
  "/src/App.tsx": `import React from 'react';\n\nfunction App() {\n  return <div>Hello World</div>;\n}\n\nexport default App;`,
  "/src/main.tsx": `import React from 'react';\nimport ReactDOM from 'react-dom';\nimport App from './App';\n\nReactDOM.createRoot(document.getElementById('root')).render(<App />);`,
  "/package.json": `{\n  "name": "local-dev",\n  "version": "1.0.0"\n}`,
  "/README.md": `# LocalDev\n\nA cool local IDE.`,
};

// Toggle to use mocks if backend is unreachable
const USE_MOCKS = false;

const api = axios.create({
  baseURL: "http://localhost:8000",
});

export const fs = {
  readDirectory: async (path: string): Promise<{ entries: FileEntry[] }> => {
    if (USE_MOCKS) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));
      if (path === "./" || path === "/") return { entries: MOCK_FILE_TREE };
      // Simple mock for subdirectories - just return empty or find in mock tree if implemented recursively
      return { entries: [] };
    }
    const { data } = await api.post("/fs/read-directory", { path });
    return data;
  },

  readFile: async (path: string): Promise<FileContent> => {
    if (USE_MOCKS) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { content: MOCK_FILES[path] || "// File content not found in mock" };
    }
    const { data } = await api.post("/fs/read-file", { path });
    return data;
  },

  writeFile: async (path: string, content: string): Promise<{ status: string }> => {
    if (USE_MOCKS) {
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`[Mock Write] ${path}:`, content);
        MOCK_FILES[path] = content;
        return { status: "success" };
    }
    const { data } = await api.post("/fs/write-file", { path, content });
    return data;
  },
};

export const rag = {
  indexFile: async (file_path: string, content: string): Promise<{ status: string }> => {
    if (USE_MOCKS) {
        await new Promise(resolve => setTimeout(resolve, 800));
        return { status: "indexed" };
    }
    const { data } = await api.post("/rag/index", { file_path, content });
    return data;
  },
  getContext: async (query: string, current_file: string | null = null): Promise<{ context: string }> => {
    const { data } = await api.post("/rag/context", { query, current_file });
    return data;
  },
  clearIndex: async (): Promise<{ status: string }> => {
    const { data } = await api.post("/rag/clear");
    return data;
  },
};

export const llm = {
  chat: async (messages: ChatMessage[]): Promise<ChatResponse> => {
    if (USE_MOCKS) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { content: "I analyzed your code. It looks correct, but you might want to add error handling to the `fs.readFile` call." };
    }
    const { data } = await api.post("/ollama/chat", { model: "llama3", messages });
    return data;
  },
  generateEmbedding: async (text: string): Promise<{ embedding: number[] }> => {
    const { data } = await api.post("/ollama/generate_embedding", { text });
    return data;
  },
  check: async (): Promise<{ available: boolean }> => {
    const { data } = await api.get("/ollama/check");
    return data;
  },
  models: async (): Promise<{ models: string[] }> => {
    const { data } = await api.get("/ollama/models");
    return data;
  },
};
