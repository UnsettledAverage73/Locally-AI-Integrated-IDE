import { MonacoLanguageClient, MessageTransports } from 'monaco-languageclient';
import { State } from 'vscode-languageclient';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { initialize } from 'vscode/services';

export async function createLanguageClient(
    editor: monaco.editor.IStandaloneCodeEditor,
    onStateChange: (state: State) => void
): Promise<MonacoLanguageClient> {
    await initialize();
    const url = 'ws://127.0.0.1:8000/ws/lsp';
    const webSocket = new WebSocket(url);

    const reader = new WebSocketMessageReader(webSocket as any);
    const writer = new WebSocketMessageWriter(webSocket as any);
    
    const client = new MonacoLanguageClient({
        name: 'Python Language Client',
        clientOptions: {
            documentSelector: ['python'],
            errorHandler: {
                error: () => ({ action: 1 }), // ErrorAction.Continue
                closed: () => ({ action: 1 })  // CloseAction.DoNotRestart
            },
        },
        connectionProvider: {
            get: (errorHandler, closeHandler) => {
                return Promise.resolve({ reader, writer });
            }
        }
    });

    client.onDidChangeState(e => onStateChange(e.newState));

    client.start();
    reader.onClose(() => client.stop());

    return client;
}
