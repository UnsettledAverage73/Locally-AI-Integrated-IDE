import pytest
import asyncio
import os
import shutil
import json
from unittest.mock import MagicMock, AsyncMock, patch

# Adjust path to import backend modules
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from services.llm_service import chat_with_tools

# Mock response from Ollama when it decides to call a tool
TOOL_CALL_RESPONSE = {
    'message': {
        'role': 'assistant',
        'content': '',
        'tool_calls': [
            {
                'function': {
                    'name': 'scaffold_project',
                    'arguments': {
                        'base_path': 'test_scaffold_project',
                        'file_structure': {
                            "main.py": "print('Hello Scaffolding')",
                            "README.md": "# Test Project"
                        }
                    }
                }
            }
        ]
    }
}

# Mock response after tool execution
FINAL_RESPONSE = {
    'message': {
        'role': 'assistant',
        'content': 'I have created the project for you.'
    }
}

@pytest.mark.asyncio
async def test_scaffold_flow():
    # Setup: Ensure target directory doesn't exist
    if os.path.exists("test_scaffold_project"):
        shutil.rmtree("test_scaffold_project")

    # Mock the Ollama AsyncClient
    with patch("services.llm_service.client") as mock_client:
        # First call returns the tool call, second call returns final text
        mock_client.chat = AsyncMock(side_effect=[TOOL_CALL_RESPONSE, FINAL_RESPONSE])

        # Execute
        messages = [{"role": "user", "content": "Create a project named test_scaffold_project"}]
        response = await chat_with_tools("qwen2.5:0.5b", messages)

        # Verification 1: Check if response is correct
        assert response == "I have created the project for you."

        # Verification 2: Check if files were actually created on disk
        # (The real MCP tool is used, only the LLM decision is mocked)
        assert os.path.exists("test_scaffold_project")
        assert os.path.exists("test_scaffold_project/main.py")
        assert os.path.exists("test_scaffold_project/README.md")
        
        with open("test_scaffold_project/main.py", "r") as f:
            content = f.read()
            assert content == "print('Hello Scaffolding')"

    # Cleanup
    if os.path.exists("test_scaffold_project"):
        shutil.rmtree("test_scaffold_project")
