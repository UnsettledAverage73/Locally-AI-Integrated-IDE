import asyncio
import os
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
Output ONLY the full, complete, and valid source code for the entire file. 
Do not include any explanations, markdown code blocks (like ```python), or any other text.
Your entire response will be written directly to the file.
"""

class FixerService:
    async def propose_fix(self, file_path: str, line_number: int, error_message: str):
        """
        Proposes a fix for an error in a file by returning the full fixed content.
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
            
            # Use the configured Ollama client
            client = get_ollama_client()
            
            # Using a low temperature for more deterministic code generation
            response = await client.chat(
                model="qwen2.5:0.5b", 
                messages=messages,
                options={"temperature": 0.1}
            )

            fixed_content = response["message"]["content"]
            
            # Clean up potential markdown wrappers if the model ignores instructions
            if fixed_content.startswith("```"):
                lines = fixed_content.splitlines()
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                fixed_content = "\n".join(lines)
            
            fixed_content = fixed_content.strip()

            # Generate unified diff
            import difflib
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
