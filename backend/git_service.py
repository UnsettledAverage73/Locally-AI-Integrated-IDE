import subprocess
import os
from typing import List, Dict, Optional
from prompt_loader import prompt_registry
from services import OllamaService, RAGService


class GitService:
    def __init__(self, ollama_service: OllamaService):
        self.ollama = ollama_service

    def _run_git(self, args: List[str], cwd: str = ".") -> str:
        try:
            result = subprocess.run(
                ["git"] + args, cwd=cwd, capture_output=True, text=True, check=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            raise Exception(f"Git Error: {e.stderr}")

    def get_status(self, cwd: str = ".") -> List[Dict[str, str]]:
        # M = modified, A = added, D = deleted, ?? = untracked
        output = self._run_git(["status", "--porcelain"], cwd)
        changes = []
        for line in output.splitlines():
            if not line.strip():
                continue
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

    def is_git_repository(self, cwd: str = ".") -> bool:
        try:
            # Check if it's actually a git repo first
            result = subprocess.run(
                ["git", "rev-parse", "--is-inside-work-tree"], 
                cwd=cwd, 
                capture_output=True, 
                text=True
            )
            return result.returncode == 0
        except FileNotFoundError:
            # Git command not found
            return False
        except Exception:
            # Other errors, assume not a git repo
            return False

    def get_current_branch(self, cwd: str = ".") -> str:
        if not self.is_git_repository(cwd):
            return "No Git Repo"
        try:
            return self._run_git(["branch", "--show-current"], cwd)
        except Exception:
            return "Error"

    def get_branches(self, cwd: str = ".") -> List[str]:
        if not self.is_git_repository(cwd):
            return []
        try:
            output = self._run_git(["branch"], cwd)
            branches = []
            for line in output.splitlines():
                branch_name = line.strip()
                if branch_name.startswith("*"):
                    branch_name = branch_name[1:].strip()
                branches.append(branch_name)
            return branches
        except Exception:
            return []

    async def generate_commit_message(
        self, cwd: str = ".", diff: Optional[str] = None
    ) -> str:
        # If a diff isn't provided, generate one from staged changes.
        if diff is None:
            try:
                diff = self._run_git(["diff", "--staged"], cwd)
            except Exception as e:
                return f"Error: Could not get diff. {str(e)}"

            if not diff.strip():
                return "No changes staged to commit."

        prompt = prompt_registry.get_prompt("git_agent", diff_content=diff[:2000])

        messages = [{"role": "user", "content": prompt}]

        # Let's try to list models and pick a suitable one, defaulting to 'qwen2.5:0.5b'.
        available_models = await self.ollama.list_models()
        model = "qwen2.5:0.5b"  # default
        # A simple logic to find a suitable model if the default is not available.
        if "qwen2.5:0.5b" not in [m["name"] for m in available_models]:
            if available_models:
                model = available_models[0]["name"]
            else:
                # No models available at all
                return "Error: No Ollama models available to generate commit message."

        import time
        from telemetry import telemetry

        start_time = time.time()

        try:
            commit_message = await self.ollama.chat_completion(model, messages)

            telemetry.log_trace(
                feature="git_agent",
                model=model,
                start_time=start_time,
                input_text=prompt,
                output_text=commit_message,
            )
            return commit_message
        except Exception as e:
            telemetry.log_trace(
                feature="git_agent",
                model=model,
                start_time=start_time,
                input_text=prompt,
                output_text=str(e),
                success=False,
            )
            return f"Error generating commit message: {str(e)}"
