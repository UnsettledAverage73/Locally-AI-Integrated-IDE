import re
from tree_sitter import Language, Parser
from tree_sitter_language_pack import get_language

def get_node_text(node, code_bytes):
    """Helper to get text from a node."""
    return code_bytes[node.start_byte:node.end_byte].decode('utf8', errors='ignore')

def prune_code(code: str, language: str, query: str) -> str:
    """
    Prunes code to keep structural elements, but intelligently retains the full body
    of functions or classes that appear to be the subject of the user's query.
    """
    try:
        lang = get_language(language)
        parser = Parser()
        parser.set_language(lang)
        tree = parser.parse(bytes(code, "utf8"))
        code_bytes = bytes(code, "utf8")

        # Extract potential function/class names from the user query
        # This is a simple heuristic and can be improved.
        queried_names = set(re.findall(r'\b([a-zA-Z_][a-zA-Z0-9_]{2,})\b', query))

        query_string = """
        [(function_definition name: (identifier) @name) @func
         (class_definition name: (identifier) @name) @class
         (method_definition name: (identifier) @name) @method]
        """
        try:
            ts_query = lang.query(query_string)
            captures = ts_query.captures(tree.root_node)
        except Exception as e:
            print(f"Tree-sitter query failed for {language}: {e}.")
            return code

        if not captures:
            return code

        # Separate captures to easily find the function/class node and its name node
        node_map = {}
        for node, name_str in captures:
            if name_str == 'name':
                continue # This is the name identifier, not the container
            
            name_node = next((n for n, s in captures if s == 'name' and n.parent == node), None)
            if name_node:
                node_map[node.id] = (node, get_node_text(name_node, code_bytes))

        if not node_map:
            return code

        sorted_nodes = sorted(node_map.values(), key=lambda item: item[0].start_byte)
        
        parts = []
        last_index = 0

        for node, name in sorted_nodes:
            body = node.child_by_field_name('body')
            
            # If the function/class name is in the query, DON'T prune its body
            if name in queried_names:
                continue

            if body:
                parts.append(code_bytes[last_index:body.start_byte])
                parts.append(b"...")
                last_index = body.end_byte
        
        parts.append(code_bytes[last_index:])
        
        return b"".join(parts).decode("utf-8", errors="ignore")

    except Exception as e:
        print(f"Error pruning code for language '{language}': {e}")
        return code
