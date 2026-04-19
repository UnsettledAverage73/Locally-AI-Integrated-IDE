import asyncio
import os
import json
import sys

# Add the current directory to sys.path so we can import from services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ralph_engine import RalphEngine

# Define your test scenarios here
TEST_SCENARIOS = [
    {
        "name": "File Creation Test",
        "instructions": "Create a file named 'success.txt' and write 'The agent was here' inside it. Then output the tag <outcome_achieved>.",
        "prd": "The agent must be able to create a specific file to prove basic functionality.",
        "verify_script": "ls success.txt && grep 'The agent was here' success.txt"
    },
    {
        "name": "Python Script Test",
        "instructions": "Create a python script called 'calc.py' that adds 2 and 2. Run it and ensure the output is 4. Then output the tag <outcome_achieved>.",
        "prd": "The agent must write and execute code autonomously.",
        "verify_script": "python3 calc.py | grep '4'"
    }
]

async def run_headless_scenario(scenario, model="qwen2.5:0.5b"):
    print(f"\n🧪 RUNNING SCENARIO: {scenario['name']}")
    
    # Setup the workspace for this test
    test_dir = f"tests/headless/{scenario['name'].replace(' ', '_').lower()}"
    os.makedirs(test_dir, exist_ok=True)
    
    # Initialize files required by Ralph Engine
    with open(os.path.join(test_dir, "prompts.md"), "w") as f:
        f.write(scenario["instructions"])
    with open(os.path.join(test_dir, "prd.json"), "w") as f:
        f.write(json.dumps({"objective": scenario["prd"]}))
    
    # Create verify.sh
    verify_path = os.path.join(test_dir, "verify.sh")
    with open(verify_path, "w") as f:
        f.write(f"#!/bin/bash\n{scenario['verify_script']}")
    os.chmod(verify_path, 0o755) # Make it executable
    
    # Initialize and start the Ralph Engine in this directory
    engine = RalphEngine(model=model, work_dir=test_dir)
    # 5 iterations is usually enough for simple headless tests
    await engine.start(max_iterations=5)
    
    print(f"🏁 Scenario {scenario['name']} finished. Logs: {test_dir}/ralph_log.txt")

async def main():
    model = "qwen2.5:0.5b"
    if "--model" in sys.argv:
        try:
            idx = sys.argv.index("--model")
            model = sys.argv[idx + 1]
        except IndexError:
            pass
            
    # Ensure base test directory exists
    os.makedirs("tests/headless", exist_ok=True)
    
    for scenario in TEST_SCENARIOS:
        await run_headless_scenario(scenario, model=model)

if __name__ == "__main__":
    asyncio.run(main())
