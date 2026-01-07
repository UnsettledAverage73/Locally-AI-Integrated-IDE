export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
}

export interface FileContent {
  content: string;
}

export interface ToolCall {
  function: {
    name: string;
    arguments: any;
  };
}

export interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: ToolCall[];
}

export interface ChatResponse {
  content: string;
  tool_calls?: ToolCall[];
  messages?: ChatMessage[];
  status?: "complete" | "approval_required";
}
