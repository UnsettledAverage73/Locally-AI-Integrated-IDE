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
    
    if "error" in response:
        print(f"❌ System Error: {response['error']}")
        return f"Error: {response['error']}"
    
    # 2. Agentic Loop
    while response.get("status") == "approval_required":
        tool_calls = response.get("tool_calls", [])
        
        for tool_call in tool_calls:
            func_name = tool_call['function']['name']
            func_args = tool_call['function']['arguments']
            print(f"🧠 AI Thinking: 'I need to use {func_name} with args {func_args}'")
            
            print(f"🔧 System: Executing {func_name} with args {func_args}...")
            response = await execute_tool_and_continue(
                model=model,
                messages=response["messages"], # Maintain state
                tool_call=tool_call,
                approved=True
            )
            
            if "error" in response:
                print(f"❌ System Error after tool call: {response['error']}")
                return f"Error after tool call: {response['error']}"

            # Print the tool result for transparency
            if response.get("messages") and response["messages"][-1]["role"] == "tool":
                tool_result = response["messages"][-1]["content"]
                # Truncate long results
                display_result = (tool_result[:500] + '...') if len(str(tool_result)) > 500 else tool_result
                print(f"✅ Tool Result: {display_result}")
            
            break
            
    # 3. Final Answer
    final_answer = response.get('content') or "Task complete, but no summary provided."
    print(f"💡 AI Final Answer: {final_answer}")
    return final_answer

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ai_engine.py <prompt> [--model <model_name>]")
        sys.exit(1)
    
    prompt = sys.argv[1]
    model = "qwen2.5:0.5b"
    plan_mode = False
    
    if "--plan" in sys.argv:
        plan_mode = True
        sys.argv.remove("--plan")
        
    if "--model" in sys.argv:
        try:
            idx = sys.argv.index("--model")
            model = sys.argv[idx + 1]
        except IndexError:
            print("Error: --model requires an argument")
            sys.exit(1)

    if plan_mode:
        from plan_mode import run_plan_mode
        asyncio.run(run_plan_mode(prompt, model=model))
    else:
        asyncio.run(run_autonomous_agent(prompt, model=model))
