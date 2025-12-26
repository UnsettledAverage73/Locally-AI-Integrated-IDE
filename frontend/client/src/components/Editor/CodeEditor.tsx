import React, { useRef, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import { Save, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { llm } from "@/api/client";

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
  const monacoRef = useRef<any>(null);
  const completionProviderRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
      }
    };
  }, []);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Add keybinding for Ctrl+S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });

    // Register Ghost Text Provider
    if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
    }

    completionProviderRef.current = monaco.languages.registerInlineCompletionsProvider(
      { pattern: "**/*" },
      {
        provideInlineCompletions: async (model: any, position: any, context: any, token: any) => {
          // Get text before and after cursor
          const prefix = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          const suffix = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: position.column,
            endLineNumber: model.getLineCount(),
            endColumn: model.getLineMaxColumn(model.getLineCount()),
          });

          // Only trigger if we have some context
          if (prefix.trim().length < 5) {
            return { items: [] };
          }

          // Wait a bit to see if user keeps typing (debounce)
          await new Promise(resolve => setTimeout(resolve, 300));
          if (token.isCancellationRequested) {
            return { items: [] };
          }

          try {
            const { content } = await llm.complete(prefix, suffix);
            
            if (token.isCancellationRequested || !content) {
              return { items: [] };
            }

            return {
              items: [
                {
                  insertText: content,
                  range: {
                    startLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column,
                  },
                },
              ],
            };
          } catch (e) {
            console.error("Ghost text error:", e);
            return { items: [] };
          }
        },
        freeInlineCompletions: () => {},
        disposeInlineCompletions: () => {},
      }
    );
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
            inlineSuggest: {
              enabled: true,
              mode: "prefix",
            },
            suggest: {
                preview: true,
            }
          }}
        />
      </div>
    </div>
  );
}
