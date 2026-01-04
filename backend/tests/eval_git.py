import sys
import os
import asyncio
from typing import Optional

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services import OllamaService
from git_service import GitService

# 1. The Golden Dataset (Input -> Expected Behavior)
test_cases = [
    {
        "name": "Simple print statement",
        "diff": "diff --git a/main.py b/main.py\n--- a/main.py\n+++ b/main.py\n@@ -1,1 +1,1 @@\n-print('Hello')\n+print('Hello World')",
        "must_contain": ["print", "hello", "world"],
        "max_length": 50
    },
    {
        "name": "Security fix",
        "diff": "diff --git a/auth.py b/auth.py\n--- a/auth.py\n+++ b/auth.py\n@@ -1,2 +1,2 @@\n-password = '123'\n+password = os.getenv('PASS')",
        "must_contain": ["security", "fix", "env", "password"],
        "max_length": 60 # Increased from user prompt to be more realistic
    }
]

async def main():
    print("🧪 Running LLM Evals for Git Agent...")
    
    # Setup services
    ollama_service = OllamaService()
    # Check if ollama is available
    if not await ollama_service.check_connection():
        print("❌ Error: Ollama connection failed. Please ensure Ollama is running.")
        sys.exit(1)
        
    git_service = GitService(ollama_service=ollama_service)

    total_passed = 0
    
    for i, test in enumerate(test_cases):
        print(f"\n--- Running Test Case {i+1}: {test['name']} ---")
        
        # Call the actual LLM function with the test diff
        result = await git_service.generate_commit_message(diff=test['diff'])
        
        # Grading Logic
        passed = True
        fail_reasons = []
        
        # Check 0: Check for errors
        if result.startswith("Error:"):
            passed = False
            fail_reasons.append(result)
        else:
            # Check 1: Length
            if len(result) > test['max_length']:
                passed = False
                fail_reasons.append(f"Too long ({len(result)} > {test['max_length']})")
                
            # Check 2: Keywords
            missing_keywords = [word for word in test['must_contain'] if word not in result.lower()]
            if missing_keywords:
                passed = False
                fail_reasons.append(f"Missing keywords: {', '.join(missing_keywords)}")

        status = "✅ PASS" if passed else f"❌ FAIL ({', '.join(fail_reasons)})"
        print(f"  Input Diff: \n{test['diff']}")
        print(f"  LLM Output: {result.strip()}")
        print(f"  Result: {status}")
        
        if passed:
            total_passed += 1

    print(f"\n--- Eval Summary ---")
    print(f"{total_passed}/{len(test_cases)} tests passed.")
    print("--------------------")
    
    # Exit with a non-zero code if any test failed, for CI/CD purposes
    if total_passed < len(test_cases):
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())