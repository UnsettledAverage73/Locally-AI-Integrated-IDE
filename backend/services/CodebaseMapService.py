import os
import ast
from typing import List, Dict

class CodebaseMapService:
    def __init__(self, root_dir: str = "."):
        self.root_dir = root_dir

    def generate_map(self) -> str:
        """
        Generates a text-based map of the codebase.
        """
        code_map = []
        for root, dirs, files in os.walk(self.root_dir):
            # Skip hidden directories and virtual environments
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ['venv', 'node_modules', '__pycache__']]
            
            for file in files:
                if file.endswith(('.py', '.ts', '.tsx', '.js', '.jsx')):
                    file_path = os.path.relpath(os.path.join(root, file), self.root_dir)
                    symbols = self._extract_symbols(os.path.join(root, file))
                    if symbols:
                        code_map.append(f"File: {file_path}\nSymbols: {', '.join(symbols)}")
                    else:
                        code_map.append(f"File: {file_path}")

        return "\n\n".join(code_map)

    def _extract_symbols(self, file_path: str) -> List[str]:
        """
        Extracts top-level symbols (classes, functions) from a file.
        """
        symbols = []
        try:
            if file_path.endswith('.py'):
                with open(file_path, "r", encoding="utf-8") as f:
                    tree = ast.parse(f.read())
                    for node in tree.body:
                        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            symbols.append(f"fn {node.name}")
                        elif isinstance(node, ast.ClassDef):
                            symbols.append(f"class {node.name}")
            elif file_path.endswith(('.ts', '.tsx', '.js', '.jsx')):
                # Simple regex-based extraction for TS/JS
                import re
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                    # Match class Name
                    classes = re.findall(r'class\s+([a-zA-Z0-9_]+)', content)
                    for c in classes:
                        symbols.append(f"class {c}")
                    # Match function name or const name = (...) =>
                    funcs = re.findall(r'function\s+([a-zA-Z0-9_]+)', content)
                    for f in funcs:
                        symbols.append(f"fn {f}")
                    const_funcs = re.findall(r'const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>', content)
                    for cf in const_funcs:
                        symbols.append(f"fn {cf}")
        except Exception:
            pass # Skip if parsing fails
        return symbols

codebase_map_service = CodebaseMapService()
