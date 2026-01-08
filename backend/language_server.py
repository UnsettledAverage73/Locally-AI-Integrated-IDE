import asyncio
from typing import List, Optional

from jedi import Script
from pygls.lsp.server import LanguageServer
from lsprotocol.types import (
    TEXT_DOCUMENT_COMPLETION,
    TEXT_DOCUMENT_DID_CHANGE,
    TEXT_DOCUMENT_DID_OPEN,
    TEXT_DOCUMENT_HOVER,
    CompletionItem,
    CompletionList,
    CompletionOptions,
    CompletionParams,
    ConfigurationItem,
    DidChangeTextDocumentParams,
    DidOpenTextDocumentParams,
    Hover,
    HoverParams,
    MarkupContent,
    MarkupKind,
    Position,
    Range,
)

class PythonLanguageServer(LanguageServer):
    CMD_GET_COMPLETIONS = 'getCompletions'
    CMD_GET_HOVER = 'getHover'

    CONFIGURATION_SECTION = 'python'

    def __init__(self, *args):
        super().__init__(*args)

server = PythonLanguageServer('python-language-server', 'v0.1')

def _validate(ls, params):
    text_doc = ls.workspace.get_document(params.text_document.uri)
    source = text_doc.source
    diagnostics = []
    
    script = Script(source)
    errors = script.get_syntax_errors()
    
    for err in errors:
        line = err.line - 1
        col = err.column
        
        range = Range(
            start=Position(line=line, character=col),
            end=Position(line=line, character=col + (err.until_column - err.column))
        )
        
        diagnostics.append({
            'range': range,
            'message': err.get_message(),
            'severity': 1 # Error
        })

    ls.publish_diagnostics(text_doc.uri, diagnostics)

@server.feature(TEXT_DOCUMENT_DID_CHANGE)
def did_change(ls: PythonLanguageServer, params: DidChangeTextDocumentParams):
    """Text document did change notification."""
    _validate(ls, params)


@server.feature(TEXT_DOCUMENT_DID_OPEN)
async def did_open(ls: PythonLanguageServer, params: DidOpenTextDocumentParams):
    """Text document did open notification."""
    _validate(ls, params)


@server.feature(
    TEXT_DOCUMENT_COMPLETION,
    CompletionOptions(trigger_characters=[',', '.']),
)
def completions(
    ls: PythonLanguageServer, params: CompletionParams
) -> CompletionList:
    """Completions."""
    text_doc = ls.workspace.get_document(params.text_document.uri)
    source = text_doc.source
    line = params.position.line
    col = params.position.character

    script = Script(source, line, col)
    completions = script.complete()
    
    return CompletionList(
        is_incomplete=False,
        items=[
            CompletionItem(
                label=c.name,
                kind=c.type,
                documentation=c.docstring(),
            )
            for c in completions
        ],
    )

@server.feature(TEXT_DOCUMENT_HOVER)
def hover(ls: PythonLanguageServer, params: HoverParams) -> Optional[Hover]:
    """Hover."""
    text_doc = ls.workspace.get_document(params.text_document.uri)
    source = text_doc.source
    line = params.position.line
    col = params.position.character

    script = Script(source, line, col)
    definitions = script.infer()
    
    if not definitions:
        return None
        
    # Get the first definition
    definition = definitions[0]
    
    docstring = definition.docstring()
    
    # Create a hover content
    return Hover(
        contents=MarkupContent(
            kind=MarkupKind.Markdown,
            value=docstring
        )
    )

if __name__ == '__main__':
    server.start_io()
