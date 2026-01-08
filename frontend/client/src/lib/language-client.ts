import { MonacoLanguageClient, CloseAction, ErrorAction, MonacoServices, MessageTransports } from 'monaco-languageclient';
import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

export function createLanguageClient(editor: monaco.editor.IStandaloneCodeEditor): MonacoLanguageClient {
    const url = 'ws://127.0.0.1:8000/ws/lsp';
    const webSocket = new WebSocket(url);

    const services = MonacoServices.create(editor);

    const reader = new WebSocketMessageReader(webSocket as any);
    const writer = new WebSocketMessageWriter(webSocket as any);
    const socket = toSocket(webSocket as any);
    
    const client = new MonacoLanguageClient({
        name: 'Python Language Client',
        clientOptions: {
            documentSelector: ['python'],
            errorHandler: {
                error: () => ({ error: ErrorAction.Continue }),
                closed: () => ({ error: CloseAction.DoNotRestart }),
            },
        },
        services,
        connectionProvider: {
            get: (errorHandler, closeHandler) => {
                return Promise.resolve({ reader, writer });
            }
        }
    });

    client.start();
    reader.onClose(() => client.stop());

    return client;
}
