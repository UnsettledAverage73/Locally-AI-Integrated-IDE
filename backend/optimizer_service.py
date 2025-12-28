import os
import ollama

class OptimizerService:
    def optimize_file(self, file_path: str, instruction: str = "Fix bugs and optimize code", model: str = "deepseek-coder"):
        # 1. READ the file directly from disk
        if not os.path.exists(file_path):
            return {"error": "File not found"}
            
        with open(file_path, "r", encoding="utf-8") as f:
            original_code = f.read()

        # 2. CONSTRUCT the strict prompt
        # We tell the AI strictly: "Do not apologize. Do not talk. Just output code."
        prompt = f"""
        You are a senior code optimization agent. I have file access.
        
        FILE: {file_path}
        INSTRUCTION: {instruction}
        
        CURRENT CODE:
        ```
        {original_code}
        ```
        
        TASK: Rewrite the entire file to fix bugs, add type hints, and optimize logic.
        IMPORTANT: Output ONLY the full valid code block. No markdown, no explanations.
        """

        # 3. CALL the AI (Use a smart model like deepseek-coder)
        try:
            response = ollama.chat(
                model=model, 
                messages=[{'role': 'user', 'content': prompt}],
                options={'temperature': 0.1} # Low temp = strict code
            )
            
            optimized_code = response['message']['content']
            
            # Clean up potential markdown wrapper (```python ... ```)
            optimized_code = optimized_code.replace("```python", "").replace("```typescript", "").replace("```", "").strip()

            # 4. WRITE back to disk (The "Fix")
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(optimized_code)
                
            return {"status": "success", "message": f"Optimized {file_path}"}
            
        except Exception as e:
            return {"error": str(e)}
