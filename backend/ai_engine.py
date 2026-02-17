import asyncio
import sys
import os

# Add the current directory to sys.path so we can import from services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.llm_service import chat_with_tools, execute_tool_and_continue

async def run_autonomous_agent(prompt: str, model: str = "qwen2.5:0.5b"):
    """
    Runs the AI in an autonomous agentic loop.
    It automatically approves and executes tool calls until the task is done.
    """
    print(f"🤖 User: {prompt}")
    
    messages = [{"role": "user", "content": prompt}]
    
    # 1. Initial Chat
    response = await chat_with_tools(model, messages)
    
    # 2. Agentic Loop
    while response.get("status") == "approval_required":
        tool_calls = response.get("tool_calls", [])
        
        for tool_call in tool_calls:
            func_name = tool_call['function']['name']
            func_args = tool_call['function']['arguments']
            print(f"🧠 AI Thinking: 'I need to use {func_name} with args {func_args}'")
            
            # 3. Execution (Auto-Approve)
            # Note: In a real 'execute_tool_and_continue', it handles one tool call at a time if designed that way, 
            # or we might need to be careful if it expects a specific format.
            # Looking at llm_service.py: execute_tool_and_continue takes a single 'tool_call' dict.
            # But 'response' might contain multiple. 
            # The current llm_service implementation recursively continues.
            
            # Let's execute the first one and let the recursion handle the rest or re-plan?
            # Actually, `execute_tool_and_continue` appends the result and calls chat again.
            # If we have multiple tools, we should probably execute them all?
            # But the current architecture of llm_service seems to favor one-step-at-a-time or 
            # the standard OAI pattern where tool_outputs are submitted together.
            
            # For simplicity/safety with the existing service, let's handle the first tool call, 
            # get the new state, and loop.
            
            print(f"🔧 System: Executing {func_name}...")
            response = await execute_tool_and_continue(
                model=model,
                messages=response["messages"], # Maintain state
                tool_call=tool_call,
                approved=True
            )
            
            # After execution, we break the inner loop to process the new response 
            # (which might request more tools or be complete)
            break
            
    # 3. Final Answer
    print(f"💡 AI Final Answer: {response.get('content')}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ai_engine.py <prompt> [--model <model_name>]")
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

    asyncio.run(run_autonomous_agent(prompt, model=model))
