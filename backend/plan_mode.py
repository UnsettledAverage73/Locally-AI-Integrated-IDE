import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.llm_service import chat_with_tools, execute_tool_and_continue

PLAN_MODE_PROMPT = """You are in PLAN MODE. 
Your objective is to research the user's request SAFELY, design a solution, and write a detailed plan.

AVAILABLE TOOLS:
You have access to search (glob, grep_search), filesystem (list_files, read_file), and planning (write_file) tools.

CONSTRAINTS:
- DO NOT make any code changes to existing source files.
- DO NOT execute commands that modify the system state or run code.
- ONLY use write_file to create a NEW plan document (e.g., 'plan.md').

WORKFLOW:
1. Use list_files, read_file, glob, or grep_search to understand the codebase relevant to the user's request.
2. Analyze the requirements and design a technical strategy.
3. Write your final plan to 'plan.md' using the write_file tool.
4. Once the plan is written, provide a brief summary of the plan as your final answer.
"""

async def run_plan_mode(prompt: str, model: str = "qwen2.5:0.5b"):
    print(f"📝 Entering Plan Mode for: {prompt}")
    
    messages = [
        {"role": "system", "content": PLAN_MODE_PROMPT},
        {"role": "user", "content": prompt}
    ]
    
    response = await chat_with_tools(model, messages)
    
    while response.get("status") == "approval_required":
        tool_calls = response.get("tool_calls", [])
        
        for tool_call in tool_calls:
            func_name = tool_call['function']['name']
            func_args = tool_call['function']['arguments']
            print(f"🧠 Planner Thinking: 'I need to use {func_name} with args {func_args}'")
            
            print(f"🔍 System: Executing read-only/planning tool {func_name}...")
            response = await execute_tool_and_continue(
                model=model,
                messages=response["messages"],
                tool_call=tool_call,
                approved=True
            )
            break
            
    final_answer = response.get('content')
    print(f"💡 Plan Ready: {final_answer}")
    return final_answer

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python plan_mode.py <prompt> [--model <model_name>]")
        sys.exit(1)
    
    prompt = sys.argv[1]
    model = "qwen2.5:0.5b"
    if "--model" in sys.argv:
        try:
            idx = sys.argv.index("--model")
            model = sys.argv[idx + 1]
        except IndexError:
            print("Error: --model requires an argument")
            sys.exit(1)

    asyncio.run(run_plan_mode(prompt, model=model))
