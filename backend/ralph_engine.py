import asyncio
import sys
import os
import json
import traceback
from datetime import datetime

# Add the current directory to sys.path so we can import from services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.llm_service import chat_with_tools, execute_tool_and_continue
from mcp_server.command import run_shell_command

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

    async def run_iteration(self, iteration_count):
        self.log(f"🚀 Starting Ralph Iteration #{iteration_count}")
        
        # Load context
        instructions = self.read_file_safe(self.prompt_file, "No instructions found in prompts.md")
        progress = self.read_file_safe(self.progress_file, "No progress recorded yet.")
        prd = self.read_file_safe(self.prd_file, "{}")
        
        # Construct the composite prompt
        composite_prompt = f"""
### RALPH LOOP ITERATION #{iteration_count} ###

**OBJECTIVE (from PRD):**
{prd}

**INSTRUCTIONS:**
{instructions}

**CURRENT PROGRESS / LAST STATE:**
{progress}

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
        self.write_file_safe(self.progress_file, f"Iteration {iteration_count} Result:\n{final_content}")
        self.log(f"✅ Iteration {iteration_count} complete.")
        return final_content

    async def verify_outcome(self):
        """
        Verify if the goal is achieved. 
        Can be customized to run a 'test' script or check for a tag.
        """
        self.log("🔍 Verifying outcome...")
        
        # 1. Check for the tag in progress.txt
        progress = self.read_file_safe(self.progress_file)
        if "<outcome_achieved>" in progress:
            self.log("🎯 Tag <outcome_achieved> found in output!")
            return True
            
        # 2. Run automated verification (e.g., pytest)
        # We can look for a 'verify.sh' or similar in the work directory
        verify_script = os.path.join(self.work_dir, "verify.sh")
        if os.path.exists(verify_script):
            self.log(f"🏃 Running verification script: {verify_script}")
            result = run_shell_command(f"bash {verify_script}")
            self.log(f"Verification Output:\n{result}")
            
            # Simple heuristic: if the script exits with success, we are done
            # Note: run_shell_command as implemented doesn't return exit code easily, 
            # but we could modify it or look for "Error" in output.
            if "FAIL" not in result.upper() and "ERROR" not in result.upper():
                return True
        
        return False

    async def start(self, max_iterations=20):
        self.log("🏁 Ralph Engine Initialized. Starting the Loop.")
        
        for i in range(1, max_iterations + 1):
            await self.run_iteration(i)
            
            if await self.verify_outcome():
                self.log("🎊 MISSION ACCOMPLISHED! Loop terminating.")
                break
            
            self.log("⚠️ Outcome not achieved. Relentlessly trying again...")
            # Optional: Add a small delay between iterations
            await asyncio.sleep(2)
        else:
            self.log("❌ Max iterations reached without achieving outcome.")

if __name__ == "__main__":
    # Example usage: python ralph_engine.py --model qwen2.5:0.5b
    model = "qwen2.5:0.5b"
    if "--model" in sys.argv:
        try:
            idx = sys.argv.index("--model")
            model = sys.argv[idx + 1]
        except IndexError:
            pass

    engine = RalphEngine(model=model)
    asyncio.run(engine.start())
