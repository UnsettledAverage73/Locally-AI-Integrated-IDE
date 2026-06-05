import os
import asyncio
from ollama import AsyncClient
import logging
from services.fixer_service import fixer_service

logger = logging.getLogger(__name__)

class OptimizerService:
    def __init__(self):
        self.client = AsyncClient(host="http://localhost:11434")

    async def optimize_file(self, file_path: str, instruction: str = "Fix bugs and optimize code", model: str = "qwen2.5:0.5b"):
        # 1. READ the file directly from disk
        if not os.path.exists(file_path):
            return {"error": "File not found"}
            
        with open(file_path, "r", encoding="utf-8") as f:
            original_code = f.read()

        # 2. CONSTRUCT the strict prompt
        prompt = f"""
        You are a senior code optimization agent.
        
        FILE: {file_path}
        INSTRUCTION: {instruction}
        
        CURRENT CODE:
        ```
        {original_code}
        ```
        
        TASK: Optimize the code to fix bugs, add type hints, and optimize logic.
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
        """

        # 3. CALL the AI
        try:
            response = await self.client.chat(
                model=model, 
                messages=[{'role': 'user', 'content': prompt}],
                options={'temperature': 0.1}
            )
            
            blocks_text = response['message']['content']
            optimized_code = fixer_service._apply_blocks(original_code, blocks_text)

            # 4. WRITE back to disk
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(optimized_code)
                
            return {"status": "success", "message": f"Optimized {file_path}"}
            
        except Exception as e:
            return {"error": str(e)}

    async def propose_fix(self, file_path: str, line_number: int, error_message: str):
        return await fixer_service.propose_fix(file_path, line_number, error_message)

    async def composer_edit(self, instruction: str, files: list, model: str = "qwen2.5:0.5b"):
        """
        Handles multi-file edits by asking the AI to propose changes for each.
        Returns a list of diffs.
        """
        results = []
        
        # Helper to process a single file
        async def process_file(file_path):
            try:
                if not os.path.exists(file_path):
                    return None
                
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()

                prompt = f"""
                Target File: {file_path}
                Global Goal: {instruction}
                
                Existing Content:
                ```
                {content}
                ```
                
                TASK: Propose the necessary changes for this file to achieve the global goal.
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
                """
                
                response = await self.client.chat(
                    model=model,
                    messages=[{'role': 'user', 'content': prompt}],
                    options={'temperature': 0.1}
                )
                
                blocks_text = response['message']['content']
                modified_content = fixer_service._apply_blocks(content, blocks_text)

                return {
                    "path": file_path,
                    "original": content,
                    "modified": modified_content
                }
            except Exception as e:
                logger.error(f"Error in composer_edit for {file_path}: {e}")
                return {"path": file_path, "error": str(e)}

        # Run file edits in parallel for speed
        tasks = [process_file(f) for f in files]
        all_results = await asyncio.gather(*tasks)
        
        # Filter out None and return
        return [r for r in all_results if r is not None]

