import asyncio
import sys
import os
import json
import traceback
from datetime import datetime

# Add the current directory to sys.path so we can import from services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.llm_service import chat_with_tools, execute_tool_and_continue
from mcp_server.command import run_shell_command_with_code

class RalphEngine:
    def __init__(self, model="qwen2.5:0.5b", work_dir="."):
        self.model = model
        self.work_dir = work_dir
        self.prompt_file = os.path.join(work_dir, "prompts.md")
        self.progress_file = os.path.join(work_dir, "progress.txt")
        self.prd_file = os.path.join(work_dir, "prd.json")
        self.log_file = os.path.join(work_dir, "ralph_log.txt")

    def log(self, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        formatted_message = f"[{timestamp}] {message}"
        print(formatted_message)
        with open(self.log_file, "a") as f:
            f.write(formatted_message + "\n")

    def read_file_safe(self, file_path, default=""):
        if os.path.exists(file_path):
            with open(file_path, "r") as f:
                return f.read()
        return default

    def write_file_safe(self, file_path, content):
        with open(file_path, "w") as f:
            f.write(content)

    def append_file_safe(self, file_path, content):
        with open(file_path, "a") as f:
            f.write(content)

    async def summarize_progress(self):
        """Summarizes progress.txt if it grows too large to save context window."""
        progress = self.read_file_safe(self.progress_file)
        if len(progress) > 4000:
            self.log("📝 Summarizing progress.txt to prevent context bloat...")
            prompt = (
                "Summarize the following agent progress log concisely. "
                "Retain key completed tasks, decisions made, and any current blockers or errors. "
                "Do not lose critical technical details needed for the next steps.\n\n"
                f"{progress}"
            )
            messages = [{"role": "user", "content": prompt}]
            
            try:
                response = await chat_with_tools(self.model, messages)
                summary = response.get("content", progress)
                
                # Overwrite with summary
                self.write_file_safe(self.progress_file, f"--- Summarized Progress ---\n{summary}\n")
                self.log("✅ Progress summarized successfully.")
            except Exception as e:
                self.log(f"⚠️ Failed to summarize progress: {e}")

    async def run_iteration(self, iteration_count, previous_feedback=""):
        self.log(f"🚀 Starting Ralph Iteration #{iteration_count}")
        
        # Load context
        instructions = self.read_file_safe(self.prompt_file, "No instructions found in prompts.md")
        progress = self.read_file_safe(self.progress_file, "No progress recorded yet.")
        prd = self.read_file_safe(self.prd_file, "{}")
        
        feedback_section = ""
        if previous_feedback:
            feedback_section = f"\n**FEEDBACK FROM LAST VERIFICATION:**\n{previous_feedback}\n"
            
        # Construct the composite prompt
        composite_prompt = f"""
### RALPH LOOP ITERATION #{iteration_count} ###

**ENVIRONMENT ISOLATION:**
Your current working directory is: `{os.path.abspath(self.work_dir)}`
ALL files you create, read, or execute MUST be relative to this path or using absolute paths to this directory.

**OBJECTIVE (from PRD):**
{prd}

**INSTRUCTIONS:**
{instructions}

**CURRENT PROGRESS / LAST STATE:**
{progress}
{feedback_section}
**Your Task:**
Perform the next steps to achieve the objective. 
If you think you are finished, output the tag: <outcome_achieved>
If you encountered errors in the last run, fix them now.
Use your tools to explore, write code, and run tests.
"""
        
        messages = [{"role": "user", "content": composite_prompt}]
        
        # 1. Start Chat
        response = await chat_with_tools(self.model, messages)
        
        # 2. Agentic Loop (Internal)
        step_count = 0
        max_internal_steps = 15 # Prevent infinite internal loops
        
        while response.get("status") == "approval_required" and step_count < max_internal_steps:
            tool_calls = response.get("tool_calls", [])
            if not tool_calls:
                break
                
            # Execute first tool call (standard autonomous agent pattern)
            tool_call = tool_calls[0]
            func_name = tool_call['function']['name']
            func_args = tool_call['function']['arguments']
            
            self.log(f"🧠 Step {step_count}: AI using {func_name}")
            
            response = await execute_tool_and_continue(
                model=self.model,
                messages=response["messages"],
                tool_call=tool_call,
                approved=True
            )
            step_count += 1

        # 3. Capture result and update progress.txt
        final_content = response.get("content", "No response content.")
        # REFACTOR: APPEND to the file to preserve history
        self.append_file_safe(self.progress_file, f"\n--- Iteration {iteration_count} Result ---\n{final_content}\n")
        self.log(f"✅ Iteration {iteration_count} complete.")
        return final_content

    async def verify_outcome(self):
        """
        Verify if the goal is achieved. 
        Returns a tuple: (is_successful: bool, feedback_string: str)
        """
        self.log("🔍 Verifying outcome...")
        
        # 1. Check for the tag in progress.txt
        progress = self.read_file_safe(self.progress_file)
        if "<outcome_achieved>" in progress:
            self.log("🎯 Tag <outcome_achieved> found in output!")
            return True, ""
            
        # 2. Run automated verification
        verify_script = os.path.join(self.work_dir, "verify.sh")
        command_to_run = ""
        
        if os.path.exists(verify_script):
            command_to_run = f"bash {os.path.basename(verify_script)}"
        else:
            # Auto-detect test runners if verify.sh isn't present
            files_in_dir = os.listdir(self.work_dir) if os.path.exists(self.work_dir) else []
            if "package.json" in files_in_dir:
                command_to_run = "npm test"
            elif "pytest.ini" in files_in_dir or any(f.endswith('.py') for f in files_in_dir):
                command_to_run = "pytest"

        if command_to_run:
            self.log(f"🏃 Running verification command: {command_to_run}")
            stdout, exit_code = run_shell_command_with_code(command_to_run, cwd=self.work_dir)
            self.log(f"Verification Output:\n{stdout}")
            
            # Unix standard: 0 means success. Anything else is a failure.
            if exit_code == 0:
                self.log("✅ Verification PASSED.")
                return True, ""
            else:
                self.log(f"❌ Verification FAILED (exit code: {exit_code}).")
                feedback = f"Verification command '{command_to_run}' failed with exit code {exit_code}.\nOutput:\n{stdout}"
                return False, feedback
        
        self.log("⚠️ No verification script or test runner found.")
        return False, "No automated verification available. Make sure to output <outcome_achieved> when done."

    async def start(self, max_iterations=20):
        self.log("🏁 Ralph Engine Initialized. Starting the Loop.")
        
        previous_feedback = ""
        for i in range(1, max_iterations + 1):
            await self.run_iteration(i, previous_feedback=previous_feedback)
            
            await self.summarize_progress()
            
            is_successful, previous_feedback = await self.verify_outcome()
            
            if is_successful:
                self.log("🎊 MISSION ACCOMPLISHED! Loop terminating.")
                break
            
            # REFACTOR: Dynamic thermal/rate-limit cooldown
            sleep_time = min(2 * i, 15) 
            self.log(f"⚠️ Outcome not achieved. Sleeping for {sleep_time}s before next iteration...")
            await asyncio.sleep(sleep_time)
        else:
            self.log("❌ Max iterations reached without achieving outcome.")


if __name__ == "__main__":
    # Example usage: python ralph_engine.py --model qwen2.5:0.5b --work-dir demo_workspace
    model = "qwen2.5:0.5b"
    work_dir = "."
    if "--model" in sys.argv:
        try:
            idx = sys.argv.index("--model")
            model = sys.argv[idx + 1]
        except IndexError:
            pass
    if "--work-dir" in sys.argv:
        try:
            idx = sys.argv.index("--work-dir")
            work_dir = sys.argv[idx + 1]
        except IndexError:
            pass

    engine = RalphEngine(model=model, work_dir=work_dir)
    asyncio.run(engine.start())
