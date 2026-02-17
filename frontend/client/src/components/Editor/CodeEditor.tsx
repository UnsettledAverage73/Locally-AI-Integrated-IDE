import React, { useRef, useEffect, useState } from "react";
import Editor, { DiffEditor, OnMount } from "@monaco-editor/react";
import { Save, BrainCircuit, Sparkles, Loader2, CheckCircle, Play, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { llm, optimizer } from "@/api/client";
import { createLanguageClient, State } from "@/lib/language-client";
import { MonacoLanguageClient } from "monaco-languageclient";
import { useAutoSave } from "../../hooks/useAutoSave";

const getLanguage = (filePath: string) => {
  if (!filePath) return "typescript";
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "py": return "python";
    case "js":
    case "jsx": return "javascript";
    case "ts":
    case "tsx": return "typescript";
    case "html": return "html";
    case "css": return "css";
    case "json": return "json";
    case "md": return "markdown";
    case "sql": return "sql";
    case "txt": return "plaintext";
    default: return "plaintext";
  }
};

interface CodeEditorProps {
  content: string;
  filePath: string | null;
  onChange: (value: string | undefined) => void;
  onSave: () => void;
  onIndex: () => void;
  isIndexing: boolean;
  onMonacoReady?: (getDiagnostics: (code: string, language: string) => Promise<any[]>) => void;
  onLspStateChange?: (state: State) => void;
}

export default function CodeEditor({
  content,
  filePath,
  onChange,
  onSave,
  onIndex,
  isIndexing,
  onMonacoReady,
  onLspStateChange,
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const languageClientRef = useRef<MonacoLanguageClient | null>(null);
  const [monacoInstance, setMonacoInstance] = useState<any>(null);
  const completionProviderRef = useRef<any>(null);
  
  // UI States
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Inline Edit / Diff States
  const [isInputVisible, setIsInputVisible] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [isDiffView, setIsDiffView] = useState(false);
  const [diffOriginal, setDiffOriginal] = useState("");
  const [diffModified, setDiffModified] = useState("");
  const [selectionRange, setSelectionRange] = useState<any>(null);

  // Enable Auto-Save
  const saveStatus = useAutoSave(content, filePath || "");

  const handleMagicFix = async () => {
    if (!filePath) return;
    if (!confirm(`⚠️ This will AI-rewrite ${filePath}. Continue?`)) return;

    setIsOptimizing(true);
    try {
      const model = localStorage.getItem("ai_model") || "qwen2.5:0.5b";
      await optimizer.optimizeFile(filePath, "Fix syntax errors, add missing imports, and optimize.", model);
      alert("✨ Code Optimized Successfully! Please switch tabs or reopen the file to see changes.");
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleBoilerplate = async () => {
     if (!editorRef.current) return;
     const editor = editorRef.current;
     const selection = editor.getSelection();
     const selectedText = editor.getModel().getValueInRange(selection);
     
     if (!selectedText) {
         alert("Please select a comment describing what you want to generate.");
         return;
     }

     setIsGenerating(true);
     try {
         const prompt = `Generate code for the following description. Return ONLY the code, no markdown.\n\n${selectedText}`;
         const { content } = await llm.complete(prompt, "");
         
         const op = {
             range: selection,
             text: selectedText + "\n" + content,
             forceMoveMarkers: true
         };
         editor.executeEdits("boilerplate", [op]);
     } catch (e: any) {
         alert("Generation Failed: " + e.message);
     } finally {
         setIsGenerating(false);
     }
  };

  // --- Inline Edit Logic ---

  const handleCmdK = () => {
      if (!editorRef.current) return;
      const editor = editorRef.current;
      const selection = editor.getSelection();
      
      setSelectionRange(selection);
      setIsInputVisible(true);
      // Defer focus to input
      setTimeout(() => document.getElementById("inline-edit-input")?.focus(), 50);
  };

  const submitEdit = async () => {
      if (!editorRef.current || !filePath || !instruction.trim() || !selectionRange) return;
      
      const editor = editorRef.current;
      const model = editor.getModel();
      if (!model) return;

      const selectedText = model.getValueInRange(selectionRange);
      
      setIsGenerating(true);
      setIsInputVisible(false); // Hide input while processing

      try {
          const { modified_code } = await optimizer.editSelection(filePath, selectedText, instruction);
          
          // Check if editor is still mounted/valid
          if (!editorRef.current) {
              // If unmounted during await, abort
              return;
          }

          const fullContent = model.getValue();
          setDiffOriginal(fullContent);
          
          const startOffset = model.getOffsetAt({ lineNumber: selectionRange.startLineNumber, column: selectionRange.startColumn });
          const endOffset = model.getOffsetAt({ lineNumber: selectionRange.endLineNumber, column: selectionRange.endColumn });
          
          const newContent = fullContent.substring(0, startOffset) + (modified_code || "") + fullContent.substring(endOffset);
          
          setDiffModified(newContent);
          setIsDiffView(true);
          
      } catch (e: any) {
          alert("Edit Failed: " + e.message);
          setIsInputVisible(true); // Show input again on error
      } finally {
          setIsGenerating(false);
          setInstruction("");
      }
  };

  const acceptDiff = () => {
      if (typeof diffModified === 'string') {
          onChange(diffModified);
      }
      setIsDiffView(false);
      setDiffOriginal("");
      setDiffModified("");
      // Force focus back to editor after a short delay to ensure mount
      setTimeout(() => {
          if (editorRef.current) editorRef.current.focus();
      }, 100);
  };

  const rejectDiff = () => {
      setIsDiffView(false);
      setDiffOriginal("");
      setDiffModified("");
      setTimeout(() => {
          if (editorRef.current) editorRef.current.focus();
      }, 100);
  };

  const handleEditorDidMount: OnMount = async (editor, monaco) => {
    editorRef.current = editor;
    if (monacoInstance !== monaco) {
        setMonacoInstance(monaco);
    }

    if (onLspStateChange) {
        languageClientRef.current = await createLanguageClient(editor, onLspStateChange);
    }
    
    if (onMonacoReady) {
      const getDiagnostics = (code: string, language: string): Promise<any[]> => {
        return new Promise((resolve) => {
          const tempModel = monaco.editor.createModel(code, language);
          
          setTimeout(() => {
            const markers = monaco.editor.getModelMarkers({ resource: tempModel.uri });
            tempModel.dispose();
            resolve(markers);
          }, 1000); // Wait for LSP to process
        });
      };
      onMonacoReady(getDiagnostics);
    }

    // Add keybindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
        handleCmdK();
    });
  };

  // Cleanup ref on unmount
  useEffect(() => {
      return () => {
          editorRef.current = null;
          if (languageClientRef.current) {
              languageClientRef.current.stop();
          }
      };
  }, []);

  // Manage Inline Completion Provider Lifecycle
  useEffect(() => {
    if (!monacoInstance || isDiffView) return;

    // Dispose previous if any
    if (completionProviderRef.current) {
        try {
            completionProviderRef.current.dispose();
        } catch (e) {
            console.warn("Failed to dispose completion provider", e);
        }
    }

    try {
        // Register new provider
        const provider = monacoInstance.languages.registerInlineCompletionsProvider(
        { pattern: "**/*" },
        {
            provideInlineCompletions: async (model: any, position: any, context: any, token: any) => {
            // Check if model is disposed
            if (!model || model.isDisposed()) return { items: [] };
            
            // Check if editor ref is valid
            if (!editorRef.current) return { items: [] };

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

            if (prefix.trim().length < 5) return { items: [] };

            await new Promise(resolve => setTimeout(resolve, 600)); 
            if (token.isCancellationRequested) return { items: [] };

            try {
                const { content } = await llm.complete(prefix, suffix);
                if (token.isCancellationRequested || !content) return { items: [] };

                return {
                items: [{
                    insertText: content,
                    range: {
                        startLineNumber: position.lineNumber,
                        startColumn: position.column,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column,
                    },
                }],
                };
            } catch (e) {
                return { items: [] };
            }
            },
            freeInlineCompletions: () => {},
            disposeInlineCompletions: () => {},
        }
        );
        
        completionProviderRef.current = provider;
    } catch (e) {
        console.error("Failed to register inline completions", e);
    }

    return () => {
        if (completionProviderRef.current) {
            try {
                completionProviderRef.current.dispose();
            } catch (e) {
                // ignore disposal errors on unmount
            }
        }
    };
  }, [monacoInstance, isDiffView, filePath]); // Added filePath dependency to re-register on file change safely

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
            {saveStatus === 'unsaved' && <span className="w-2 h-2 rounded-full bg-yellow-500" title="Unsaved changes" />}
        </div>
        <div className="flex items-center space-x-2">
            {!isDiffView && (
                <>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleBoilerplate}
                        disabled={isGenerating}
                        className="text-xs h-7 gap-1.5 hover:bg-blue-500/20 hover:text-blue-400 text-blue-400"
                        title="Select a comment and click to generate code"
                    >
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Generate
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleCmdK}
                        className="text-xs h-7 gap-1.5 hover:bg-yellow-500/20 hover:text-yellow-400 text-yellow-400"
                    >
                        <span className="text-[10px] border border-current px-1 rounded">⌘K</span>
                        Edit
                    </Button>
                </>
            )}
            
            {/* Diff Actions */}
            {isDiffView && (
                <div className="flex items-center gap-2 bg-background/50 rounded-md p-0.5 border border-border/50">
                     <Button size="sm" onClick={acceptDiff} className="h-6 text-xs bg-green-600 hover:bg-green-700 text-white gap-1">
                        <Check className="w-3 h-3" /> Accept
                     </Button>
                     <Button size="sm" variant="ghost" onClick={rejectDiff} className="h-6 text-xs hover:bg-red-500/20 hover:text-red-400 gap-1">
                        <X className="w-3 h-3" /> Reject
                     </Button>
                </div>
            )}

            <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleMagicFix}
                disabled={isOptimizing}
                className="text-xs h-7 gap-1.5 hover:bg-purple-500/20 hover:text-purple-400 text-purple-400"
            >
                {isOptimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Auto-Fix
            </Button>
            
            <div className="flex items-center text-xs text-muted-foreground gap-2">
                {saveStatus === 'saving' && (
                    <span className="flex items-center text-yellow-500">
                        <Loader2 className="w-3 h-3 animate-spin mr-1" /> Saving...
                    </span>
                )}
                {saveStatus === 'saved' && (
                    <span className="flex items-center text-green-500/50">
                        <CheckCircle className="w-3 h-3 mr-1" /> Saved
                    </span>
                )}
            </div>
        </div>
      </div>

      {/* Inline Input Widget */}
      {isInputVisible && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-50 w-[400px] bg-card border border-border shadow-2xl rounded-lg p-2 flex gap-2 animate-in fade-in slide-in-from-top-5">
              <Input 
                 id="inline-edit-input"
                 value={instruction}
                 onChange={e => setInstruction(e.target.value)}
                 onKeyDown={e => {
                     if (e.key === 'Enter') submitEdit();
                     if (e.key === 'Escape') setIsInputVisible(false);
                 }}
                 placeholder="Describe your change (e.g. 'Use async/await')..."
                 className="h-8 text-sm bg-background/50"
                 autoComplete="off"
              />
              <Button size="sm" className="h-8" onClick={submitEdit} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Edit"}
              </Button>
          </div>
      )}

      {/* Editor Area */}
      <div className="flex-1 relative overflow-hidden">
        {isDiffView ? (
             <DiffEditor
                height="100%"
                language={getLanguage(filePath)}
                theme="vs-dark"
                original={diffOriginal}
                modified={diffModified}
                options={{
                    renderSideBySide: true,
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', monospace",
                    scrollBeyondLastLine: false,
                    minimap: { enabled: false }
                }}
             />
        ) : (
            <Editor
            height="100%"
            language={getLanguage(filePath)}
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
        )}
      </div>
    </div>
  );
}