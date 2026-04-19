import asyncio
import os
import sys

# Ensure backend directory is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ai_engine import run_autonomous_agent

async def test_full_agent_workflow():
    print("🚀 Starting Full Agent Workflow Test...")
    
    # 1. Test Research with Codebase Investigator
    print("\n🔍 Step 1: Researching with Codebase Investigator...")
    research_prompt = """
    Use the 'codebase_investigator' tool to analyze the project structure and tell me about the MCP servers in 'backend/mcp_server/'.
    """
    # Using a slightly bigger model for better tool use if possible, or just default.
    result = await run_autonomous_agent(research_prompt, model="qwen2.5:0.5b")
    print(f"✅ Research Result: {result[:200]}...")

    # 2. Test Plan Mode via CLI or directly
    print("\n📝 Step 2: Testing Plan Mode (Direct Call)...")
    from plan_mode import run_plan_mode
    plan_prompt = "Design a better UI layout for the frontend components."
    plan_result = await run_plan_mode(plan_prompt, model="qwen2.5:0.5b")
    print(f"✅ Plan Result: {plan_result}")

if __name__ == "__main__":
    asyncio.run(test_full_agent_workflow())
