import os
import shutil
import pytest
import asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from services.llm_service import chat_with_tools, execute_tool_and_continue
from ralph_engine import RalphEngine

# Test constants
TEST_WORK_DIR = "test_ralph_workspace"

@pytest.fixture
def ralph_workspace():
    if os.path.exists(TEST_WORK_DIR):
        shutil.rmtree(TEST_WORK_DIR)
    os.makedirs(TEST_WORK_DIR)
    yield TEST_WORK_DIR
    if os.path.exists(TEST_WORK_DIR):
        shutil.rmtree(TEST_WORK_DIR)

@pytest.mark.asyncio
async def test_ralph_feedback_loop(ralph_workspace):
    """Verify that failing verification script output is passed back as feedback."""
    engine = RalphEngine(model="test-model", work_dir=ralph_workspace)
    
    # 1. Create a failing verify.sh
    verify_script = os.path.join(ralph_workspace, "verify.sh")
    with open(verify_script, "w") as f:
        f.write("#!/bin/bash\necho 'Custom Error Message'\nexit 1")
    
    # 2. Run verify_outcome and check feedback
    is_success, feedback = await engine.verify_outcome()
    
    assert is_success is False
    assert "Custom Error Message" in feedback
    assert "exit code 1" in feedback

@pytest.mark.asyncio
async def test_ralph_summarization(ralph_workspace):
    """Verify that progress.txt is summarized when it exceeds the threshold."""
    engine = RalphEngine(model="test-model", work_dir=ralph_workspace)
    
    # 1. Create a large progress.txt (> 4000 chars)
    large_content = "This is a recurring line to bloat the file. " * 100 
    engine.write_file_safe(engine.progress_file, large_content)
    
    # 2. Mock chat_with_tools to return a summary
    mock_summary = "This is the summarized content."
    with patch("ralph_engine.chat_with_tools", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = {"content": mock_summary}
        
        await engine.summarize_progress()
        
        # 3. Check if file was summarized
        new_content = engine.read_file_safe(engine.progress_file)
        assert mock_summary in new_content
        assert "Summarized Progress" in new_content
        assert len(new_content) < len(large_content)

@pytest.mark.asyncio
async def test_ralph_iteration_receives_feedback(ralph_workspace):
    """Verify that run_iteration includes previous feedback in the prompt."""
    engine = RalphEngine(model="test-model", work_dir=ralph_workspace)
    test_feedback = "The previous run failed because of X."
    
    with patch("ralph_engine.chat_with_tools", new_callable=AsyncMock) as mock_chat:
        mock_chat.return_value = {"content": "Understood.", "status": "complete"}
        
        await engine.run_iteration(1, previous_feedback=test_feedback)
        
        # Check if the feedback was in the prompt sent to the LLM
        args, kwargs = mock_chat.call_args
        messages = args[1]
        prompt_content = messages[0]['content']
        
        assert test_feedback in prompt_content
        assert "FEEDBACK FROM LAST VERIFICATION" in prompt_content

if __name__ == "__main__":
    pytest.main([__file__])
