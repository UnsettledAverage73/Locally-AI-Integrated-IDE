import subprocess
import os
from typing import List, Dict, Optional
from services import OllamaService, RAGService

class GitService:
    def __init__(self, ollama_service: OllamaService):
        self.ollama = ollama_service

    def _run_git(self, args: List[str], cwd: str = ".") -> str:
        try:
            result = subprocess.run(
                ["git"] + args,
                cwd=cwd,
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            raise Exception(f"Git Error: {e.stderr}")

    def get_status(self, cwd: str = ".") -> List[Dict[str, str]]:
        # M = modified, A = added, D = deleted, ?? = untracked
        output = self._run_git(["status", "--porcelain"], cwd)
        changes = []
        for line in output.splitlines():
            if not line.strip(): continue
            code = line[:2]
            path = line[3:]
            changes.append({"code": code, "path": path})
        return changes

    def stage_file(self, path: str, cwd: str = "."):
        self._run_git(["add", path], cwd)

    def unstage_file(self, path: str, cwd: str = "."):
        self._run_git(["reset", "HEAD", path], cwd)

    def commit(self, message: str, cwd: str = "."):
        self._run_git(["commit", "-m", message], cwd)

    async def generate_commit_message(self, cwd: str = ".") -> str:
        # Get staged diff
        try:
            diff = self._run_git(["diff", "--staged"], cwd)
        except:
            return "Error: Could not get diff."

        if not diff.strip():
            return "No changes staged to commit."

        prompt = f"""
        Instruction: Generate a concise, professional commit message following the Conventional Commits specification (e.g., 'feat(auth): add login', 'fix(api): handle timeout').
        
        The diff is:
        {diff[:3000]}  # Truncate to avoid context limit if massive
        
        Only output the commit message. No explanation.
        """
        
        # We reuse the chat_completion logic from OllamaService
        # We'll use a fast model if available, or just the default code model
        # Assuming 'deepseek-coder' or similar is loaded.
        messages = [{"role": "user", "content": prompt}]
        # Hardcoding 'deepseek-coder' or using a default from service would be better
        # For now, let's assume the frontend passes the model or we pick one.
        # We'll rely on the default model usage in OllamaService if we had a default, 
        # but chat_completion needs a model arg.
        
        # Let's try to list models and pick one, or default to deepseek-coder
        models = await self.ollama.list_models()
        model = "deepseek-coder"
        if models and "deepseek-coder" not in models and len(models) > 0:
             model = models[0] # Fallback
             
        return await self.ollama.chat_completion(model, messages)
