import os
from typing import List, Dict
import logging

try:
    from tree_sitter import Language, Parser
    import tree_sitter_language_pack as tree_sitter_languages
    HAS_TREE_SITTER = True
except ImportError:
    HAS_TREE_SITTER = False
    import ast
    import re

logger = logging.getLogger(__name__)

class CodebaseMapService:
    def __init__(self, root_dir: str = "."):
        self.root_dir = root_dir
        self.parser = None
        if HAS_TREE_SITTER:
            self.parser = Parser()

    def get_language(self, file_path: str):
        if not HAS_TREE_SITTER:
            return None
        ext = os.path.splitext(file_path)[1]
        try:
            if ext == '.py':
                return tree_sitter_languages.get_language('python')
            elif ext in ['.js', '.jsx']:
                return tree_sitter_languages.get_language('javascript')
            elif ext in ['.ts', '.tsx']:
                return tree_sitter_languages.get_language('typescript')
        except Exception as e:
            logger.warning(f"Error loading language for {ext}: {e}")
        return None

    def generate_map(self) -> str:
        """
        Generates a text-based map of the codebase.
        """
        code_map = []
        for root, dirs, files in os.walk(self.root_dir):
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['venv', 'node_modules', '__pycache__', 'dist', 'build']]
            
            for file in files:
                if file.endswith(('.py', '.ts', '.tsx', '.js', '.jsx')):
                    file_path = os.path.relpath(os.path.join(root, file), self.root_dir)
                    full_path = os.path.join(root, file)
                    symbols = self._extract_symbols(full_path)
                    if symbols:
                        code_map.append(f"File: {file_path}\nSymbols: {', '.join(symbols)}")
                    else:
                        code_map.append(f"File: {file_path}")

        return "\n\n".join(code_map)

    def _extract_symbols(self, file_path: str) -> List[str]:
        """
        Extracts symbols from a file, preferably using tree-sitter for accuracy.
        """
        symbols = []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            lang = self.get_language(file_path)
            if HAS_TREE_SITTER and lang:
                self.parser.set_language(lang)
                tree = self.parser.parse(bytes(content, "utf8"))
                
                # Queries for classes and functions based on language
                if file_path.endswith('.py'):
                    query_code = "(class_definition name: (identifier) @class) (function_definition name: (identifier) @fn)"
                elif file_path.endswith(('.ts', '.tsx', '.js', '.jsx')):
                    query_code = "(class_declaration name: (identifier) @class) (function_declaration name: (identifier) @fn) (lexical_declaration (variable_declarator name: (identifier) @fn value: [(arrow_function) (function)]))"
                else:
                    return symbols

                query = lang.query(query_code)
                captures = query.captures(tree.root_node)
                
                for capture in captures:
                    node = capture[0]
                    tag = capture[1]
                    name = content[node.start_byte:node.end_byte]
                    symbols.append(f"{tag} {name}")
                
                # Deduplicate while preserving order
                seen = set()
                return [x for x in symbols if not (x in seen or seen.add(x))]

            else:
                # Fallback naive parsing
                if file_path.endswith('.py'):
                    tree = ast.parse(content)
                    for node in tree.body:
                        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            symbols.append(f"fn {node.name}")
                        elif isinstance(node, ast.ClassDef):
                            symbols.append(f"class {node.name}")
                elif file_path.endswith(('.ts', '.tsx', '.js', '.jsx')):
                    classes = re.findall(r'class\s+([a-zA-Z0-9_]+)', content)
                    for c in classes: symbols.append(f"class {c}")
                    funcs = re.findall(r'function\s+([a-zA-Z0-9_]+)', content)
                    for f in funcs: symbols.append(f"fn {f}")
                    const_funcs = re.findall(r'const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>', content)
                    for cf in const_funcs: symbols.append(f"fn {cf}")

        except Exception as e:
            logger.error(f"Failed extracting symbols for {file_path}: {e}")
        return symbols

codebase_map_service = CodebaseMapService()
