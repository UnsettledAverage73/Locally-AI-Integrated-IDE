import React, { useRef } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { Save, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CodeEditorProps {
  content: string;
  filePath: string | null;
  onChange: (value: string | undefined) => void;
  onSave: () => void;
  onIndex: () => void;
  isIndexing: boolean;
}

export default function CodeEditor({
  content,
  filePath,
  onChange,
  onSave,
  onIndex,
  isIndexing,
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Add keybinding for Ctrl+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });
  };

  if (!filePath) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-background/50 backdrop-blur-sm">
        <BrainCircuit className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-mono">Select a file to edit</p>
        <p className="text-sm opacity-50">LocalDev Environment Ready</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] relative group">
      {/* Editor Toolbar */}
      <div className="h-10 flex items-center justify-between px-4 bg-card/80 border-b border-border backdrop-blur-sm">
        <div className="flex items-center space-x-2">
            <span className="text-sm font-mono text-muted-foreground">{filePath}</span>
        </div>
        <div className="flex items-center space-x-2">
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={onIndex}
                disabled={isIndexing}
                className={cn(
                    "text-xs h-7 gap-1.5 transition-all hover:bg-primary/20 hover:text-primary", 
                    isIndexing && "animate-pulse"
                )}
            >
                <BrainCircuit className="w-3.5 h-3.5" />
                {isIndexing ? "Indexing..." : "Add to Context"}
            </Button>
            <Button 
                variant="ghost" 
                size="sm" 
                onClick={onSave}
                className="text-xs h-7 gap-1.5 hover:bg-accent/20 hover:text-accent"
            >
                <Save className="w-3.5 h-3.5" />
                Save
            </Button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="typescript"
          language={filePath.endsWith(".json") ? "json" : filePath.endsWith(".css") ? "css" : filePath.endsWith(".html") ? "html" : "typescript"}
          theme="vs-dark"
          path={filePath} // This helps Monaco reset state when file changes
          value={content}
          onChange={onChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: true },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', monospace",
            fontLigatures: true,
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            padding: { top: 16 },
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
