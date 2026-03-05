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

export const apiClient = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 10000, // Increased timeout for robustness
});

// Simple retry interceptor
apiClient.interceptors.response.use(
  response => response,
  async (error) => {
    const { config, message } = error;
    if (!config || !config.retry) {
      config.retry = 0;
    }
    
    const MAX_RETRIES = 3;
    if (config.retry < MAX_RETRIES && (message.includes('Network Error') || message.includes('timeout'))) {
      config.retry++;
      console.log(`Retrying request (${config.retry}/${MAX_RETRIES}): ${config.url}`);
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, config.retry * 1000));
      return apiClient(config);
    }
    return Promise.reject(error);
  }
);

export const fs = {
  readDirectory: async (path: string): Promise<{ entries: FileEntry[] }> => {
    if (USE_MOCKS) {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));
      if (path === "./" || path === "/") return { entries: MOCK_FILE_TREE };
      // Simple mock for subdirectories - just return empty or find in mock tree if implemented recursively
      return { entries: [] };
    }
    const { data } = await apiClient.post("/fs/read-directory", { path });
    return data;
  },

  getFileTree: async (rootPath: string): Promise<FileEntry[]> => {
    if (USE_MOCKS) return MOCK_FILE_TREE;
    const { data } = await apiClient.get("/files/tree", { params: { root_path: rootPath } });
    return data;
  },

  readFile: async (path: string): Promise<FileContent> => {
    if (USE_MOCKS) {
      await new Promise(resolve => setTimeout(resolve, 200));
      return { content: MOCK_FILES[path] || "// File content not found in mock" };
    }
    const { data } = await apiClient.post("/fs/read-file", { path });
    return data;
  },

  writeFile: async (path: string, content: string): Promise<{ status: string }> => {
    if (USE_MOCKS) {
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log(`[Mock Write] ${path}:`, content);
        MOCK_FILES[path] = content;
        return { status: "success" };
    }
    const { data } = await apiClient.post("/fs/write-file", { path, content });
    return data;
  },

  watchDirectory: async (path: string): Promise<{ status: string }> => {
    const { data } = await apiClient.post("/fs/watch", { path });
    return data;
  },

  selectFolder: async (): Promise<string | null> => {
    return await (window as any).fileSystem.selectFolder();
  },

  selectFiles: async (): Promise<string[] | null> => {
    return await (window as any).fileSystem.selectFiles();
  },

  showSaveDialog: async (defaultName: string): Promise<{ filePath: string | null }> => {
    const { data } = await apiClient.post("/fs/save-dialog", { default_name: defaultName });
    return data;
  },
};

export const rag = {
  indexFile: async (file_path: string, content: string): Promise<{ status: string }> => {
    if (USE_MOCKS) {
        await new Promise(resolve => setTimeout(resolve, 800));
        return { status: "indexed" };
    }
    const { data } = await apiClient.post("/rag/index", { file_path, content });
    return data;
  },
  indexDirectory: async (path: string): Promise<{ status: string }> => {
    const { data } = await apiClient.post("/rag/index-directory", { path });
    return data;
  },
  getContext: async (query: string, current_file: string | null = null): Promise<{ context: string }> => {
    const { data } = await apiClient.post("/rag/context", { query, current_file });
    return data;
  },
  clearIndex: async (): Promise<{ status: string }> => {
    const { data } = await apiClient.post("/rag/clear");
    return data;
  },
};

export const llm = {
  chat: async (messages: ChatMessage[]): Promise<ChatResponse> => {
    if (USE_MOCKS) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        return { content: "I analyzed your code. It looks correct, but you might want to add error handling to the `fs.readFile` call." };
    }
    
    // Get temperature and model from profile settings
    const temp = parseFloat(localStorage.getItem("ai_temperature") || "0.4");
    const model = localStorage.getItem("ai_model") || "qwen2.5:0.5b";
    
    const { data } = await apiClient.post("/ollama/chat", { 
        model, 
        messages,
        options: { temperature: temp }
    });
    return data;
  },
  executeTool: async (messages: ChatMessage[], tool_call: any, approved: boolean): Promise<ChatResponse> => {
    const model = localStorage.getItem("ai_model") || "qwen2.5:0.5b";
    const temp = parseFloat(localStorage.getItem("ai_temperature") || "0.4");
    
    const { data } = await apiClient.post("/ollama/tool/execute", {
        model,
        messages,
        tool_call: tool_call,
        approved,
        options: { temperature: temp }
    });
    return data;
  },
  complete: async (prefix: string, suffix: string): Promise<{ content: string }> => {
    const model = localStorage.getItem("ai_model") || "qwen2.5:0.5b";
    const { data } = await apiClient.post("/ollama/complete", { 
        model, 
        prefix, 
        suffix 
    });
    return data;
  },
  generateEmbedding: async (text: string): Promise<{ embedding: number[] }> => {
    const { data } = await apiClient.post("/ollama/generate_embedding", { text });
    return data;
  },
  check: async (): Promise<{ available: boolean }> => {
    const { data } = await apiClient.get("/ollama/check");
    return data;
  },
  models: async (): Promise<{ models: string[] }> => {
    const { data } = await apiClient.get("/ollama/models");
    if (data && Array.isArray(data.models)) {
      // The backend returns a simple array of strings, so we can use it directly.
      return { models: data.models };
    }
    // Return an empty array if the structure is not what we expect.
    return { models: [] };
  },
  pullModel: async (model: string): Promise<{ status: string }> => {
    if (USE_MOCKS) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return { status: "success" };
    }
    const { data } = await apiClient.post("/ollama/pull", { model });
    return data;
  },
  deleteModel: async (model: string): Promise<{ status: string }> => {
    if (USE_MOCKS) return { status: "success" };
    const { data } = await apiClient.delete(`/ollama/models/${model}`);
    return data;
  },
  showModelInfo: async (modelName: string): Promise<any> => {
    const { data } = await apiClient.get(`/ollama/show/${encodeURIComponent(modelName)}`);
    return data;
  },
  updateAIHost: async (host: string): Promise<{ status: string, host: string, available: boolean }> => {
    const { data } = await apiClient.post("/config/ai-host", { host });
    return data;
  }
};

export const system = {
      getStats: async (): Promise<{ 
          ram_total_gb: number; 
          ram_available_gb: number; 
          disk_total_gb: number; 
          disk_free_gb: number;
          cpu?: string;
          ram?: string;
          gpu?: { available: boolean; name: string; vram: string; load: string };
          ollama?: { status: string; mode: string };
      }> => {
          if (USE_MOCKS) return { 
              ram_total_gb: 16, 
              ram_available_gb: 8, 
              disk_total_gb: 500, 
              disk_free_gb: 100,
              cpu: "12%",
              ram: "50%",
              gpu: { available: true, name: "Mock GPU", vram: "8GB", load: "20%" },
              ollama: { status: "online", mode: "🔥 GPU" }
          };
          const { data } = await apiClient.get("/api/system-resources");
          return data;
      }
  };

export const terminal = {
    create: async (): Promise<{ session_id: string }> => {
        const { data } = await apiClient.post("/terminals");
        return data;
    }
};

export const git = {
    status: async (): Promise<{ changes: { code: string; path: string }[] }> => {
        if (USE_MOCKS) return { changes: [] };
        const { data } = await apiClient.get("/git/status");
        return data;
    },
    stage: async (path: string): Promise<void> => {
        if (USE_MOCKS) return;
        await apiClient.post("/git/stage", { path });
    },
    unstage: async (path: string): Promise<void> => {
        if (USE_MOCKS) return;
        await apiClient.post("/git/unstage", { path });
    },
    generateMessage: async (): Promise<{ message: string }> => {
        if (USE_MOCKS) return { message: "feat: mock commit message" };
        const { data } = await apiClient.post("/git/generate-message");
        return data;
    },
    commit: async (message: string): Promise<void> => {
        if (USE_MOCKS) return;
        await apiClient.post("/git/commit", { message });
    },
    getBranch: async (): Promise<{ branch: string }> => {
        if (USE_MOCKS) return { branch: "main" };
        const { data } = await apiClient.get("/git/branch");
        return data;
    },
    getBranches: async (): Promise<{ branches: string[] }> => {
        if (USE_MOCKS) return { branches: ["main", "dev", "feature/test"] };
        const { data } = await apiClient.get("/git/branches");
        return data;
    },
    checkout: async (name: string): Promise<void> => {
        if (USE_MOCKS) return;
        await apiClient.post("/git/branch/checkout", { name });
    },
    createBranch: async (name: string): Promise<void> => {
        if (USE_MOCKS) return;
        await apiClient.post("/git/branch/create", { name });
    },
    push: async (): Promise<void> => {
        if (USE_MOCKS) return;
        await apiClient.post("/git/push");
    },
    pull: async (): Promise<void> => {
        if (USE_MOCKS) return;
        await apiClient.post("/git/pull");
    }
};

export const search = {
    searchFilenames: async (query: string, path: string = "."): Promise<{ results: string }> => {
        if (USE_MOCKS) return { results: "mock/file.ts\nmock/other.py" };
        const { data } = await apiClient.post("/search/filenames", { query, path });
        return data;
    },
    searchText: async (query: string, path: string = "."): Promise<{ results: string }> => {
        if (USE_MOCKS) return { results: "mock/file.ts:10: const x = 'hello'\n" };
        const { data } = await apiClient.post("/search/text", { query, path });
        return data;
    },
    contextSearch: async (contextType: string, searchTerm: string): Promise<{ context: string }> => {
        if (USE_MOCKS) return { context: "Mock context for @ search" };
        const { data } = await apiClient.post("/mcp/context-search", { context_type: contextType, search_term: searchTerm });
        return data;
    }
};

export const optimizer = {
    optimizeFile: async (path: string, instruction: string, model: string = "qwen2.5:0.5b"): Promise<{ status: string; message: string }> => {
        if (USE_MOCKS) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            return { status: "success", message: "Mock optimization complete" };
        }
        const { data } = await apiClient.post("/files/optimize", { file_path: path, instruction, model });
        return data;
    },
    proposeFix: async (filePath: string, lineNumber: number, errorMessage: string): Promise<{ diff?: string; fixed_content?: string; error?: string }> => {
        if (USE_MOCKS) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return { 
                diff: `--- a/${filePath}\n+++ b/${filePath}\n@@ -${lineNumber},1 +${lineNumber},1 @@\n- console.error("Something went wrong");\n+ console.log("Something went right");`,
                fixed_content: `// Mock fixed content\nconsole.log("Something went right");`
            };
        }
        const { data } = await apiClient.post("/optimizer/propose-fix", { file_path: filePath, line_number: lineNumber, error_message: errorMessage });
        return data;
    },
    editSelection: async (filePath: string, selectedCode: string, instruction: string): Promise<{ modified_code: string }> => {
        const model = localStorage.getItem("ai_model") || "qwen2.5:0.5b";
        const { data } = await apiClient.post("/fs/edit_selection", { file_path: filePath, selected_code: selectedCode, instruction, model });
        return data;
        }
        };

        export const cloud = {
    discover: async (): Promise<{ results: { host: string; port: number; url: string; available: boolean; models: string[] }[] }> => {
        const { data } = await apiClient.get("/cloud/discover");
        return data;
    },
    provision: async (aws_access_key: string, aws_secret_key: string, aws_session_token: string, region: string = "us-east-1"): Promise<{ status: string; instance_id: string; public_ip: string; url: string; message: string }> => {
        const { data } = await apiClient.post("/cloud/provision", { aws_access_key, aws_secret_key, aws_session_token, region });
        return data;
    }
};

