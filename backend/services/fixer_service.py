import asyncio
import os
import re
import difflib
from services.llm_service import mcp_manager, get_ollama_client

FIX_PROMPT_TEMPLATE = """
You are an expert software engineer specializing in debugging and fixing code.
A user has encountered an error in their code and needs your help to fix it.

**File Path:** {file_path}
**Error Message:** {error_message}
**Line Number (approximate):** {line_number}

**Current File Content:**
```
{file_content}
```

Your task is to fix the error described above.
To be highly efficient, you MUST use SEARCH/REPLACE blocks to apply your changes.
Do not output the entire file. Output ONLY the necessary blocks to fix the issue.

FORMAT:
<<<<
SEARCH
[exact code to replace from the original file, including indentation]
====
REPLACE
[new fixed code, maintaining correct indentation]
>>>>

Example:
<<<<
SEARCH
    def add(a, b):
        return a - b
====
REPLACE
    def add(a, b):
        return a + b
>>>>
"""

class FixerService:
    def _apply_blocks(self, content: str, blocks_text: str) -> str:
        pattern = re.compile(r'<<<<\nSEARCH\n(.*?)\n====\nREPLACE\n(.*?)\n>>>>', re.DOTALL)
        blocks = pattern.findall(blocks_text)
        
        if not blocks:
            # Fallback: if the model ignored instructions and returned full code block
            if "```" in blocks_text:
                lines = blocks_text.split("```")
                if len(lines) >= 3:
                    code_lines = lines[1].splitlines()
                    if code_lines and not code_lines[0].isspace():
                        # remove language identifier like `python`
                        code_lines = code_lines[1:]
                    return "\n".join(code_lines).strip()
            return content

        modified_content = content
        for search_text, replace_text in blocks:
            # Exact match replacement
            if search_text in modified_content:
                modified_content = modified_content.replace(search_text, replace_text, 1)
            else:
                # Try stripped fallback
                if search_text.strip() in modified_content:
                    modified_content = modified_content.replace(search_text.strip(), replace_text.strip(), 1)
                    
        return modified_content

    async def propose_fix(self, file_path: str, line_number: int, error_message: str):
        """
        Proposes a fix for an error in a file using an efficient SEARCH/REPLACE strategy.
        """
        try:
            if not os.path.exists(file_path):
                return {"error": f"File not found: {file_path}"}

            with open(file_path, "r", encoding="utf-8") as f:
                file_content = f.read()

            prompt = FIX_PROMPT_TEMPLATE.format(
                file_path=file_path,
                error_message=error_message,
                line_number=line_number,
                file_content=file_content,
            )

            messages = [{"role": "user", "content": prompt}]
            
            client = get_ollama_client()
            response = await client.chat(
                model="qwen2.5:0.5b", 
                messages=messages,
                options={"temperature": 0.1}
            )

            blocks_text = response["message"]["content"]
            fixed_content = self._apply_blocks(file_content, blocks_text)

            # Generate unified diff
            original_lines = file_content.splitlines(keepends=True)
            proposed_lines = fixed_content.splitlines(keepends=True)
            diff = difflib.unified_diff(
                original_lines,
                proposed_lines,
                fromfile=f"a/{file_path}",
                tofile=f"b/{file_path}",
                lineterm="",
            )
            diff_text = "".join(diff)

            return {
                "original_content": file_content,
                "fixed_content": fixed_content,
                "diff": diff_text,
                "file_path": file_path
            }

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"error": f"Failed to propose fix: {str(e)}"}

fixer_service = FixerService()
