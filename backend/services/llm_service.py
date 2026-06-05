import asyncio
import json
import os
import re
from ollama import AsyncClient
from config import SCAFFOLD_SYSTEM_PROMPT
from mcp_server.filesystem import mcp as filesystem_mcp
from mcp_server.command import mcp as terminal_mcp
from mcp_server.github import mcp as github_mcp
from mcp_server.search import mcp as search_mcp
from mcp_server.browser import mcp as browser_mcp
from mcp_server.ollama import mcp as ollama_mcp
from mcp_server.subagents import mcp as subagents_mcp
from mcp_server.context_search import mcp as context_search_mcp

class MCPManager:
    async def list_tools(self):
        """
        Lists available tools from the MCP server.
        Adapts FastMCP tools to Ollama's tool format.
        """
        fs_tools = await filesystem_mcp.list_tools()
        term_tools = await terminal_mcp.list_tools()
        gh_tools = await github_mcp.list_tools()
        search_tools = await search_mcp.list_tools()
        browser_tools = await browser_mcp.list_tools()
        ollama_tools = await ollama_mcp.list_tools()
        subagent_tools = await subagents_mcp.list_tools()
        context_tools = await context_search_mcp.list_tools()
        all_tools = fs_tools + term_tools + gh_tools + search_tools + browser_tools + ollama_tools + subagent_tools + context_tools
        
        tools = []
        for tool in all_tools:
            tools.append({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.inputSchema, 
                }
            })
        return tools

    async def call_tool(self, name, arguments):
        """
        Executes a tool call.
        """
        try:
            log_debug(f"🔧 Calling tool: {name} with arguments: {arguments}")
            
            # Check filesystem tools first
            fs_tools = await filesystem_mcp.list_tools()
            if any(t.name == name for t in fs_tools):
                result = await filesystem_mcp.call_tool(name, arguments)
            else:
                # Check terminal tools
                term_tools = await terminal_mcp.list_tools()
                if any(t.name == name for t in term_tools):
                    result = await terminal_mcp.call_tool(name, arguments)
                else:
                    # Check GitHub tools
                    gh_tools = await github_mcp.list_tools()
                    if any(t.name == name for t in gh_tools):
                        result = await github_mcp.call_tool(name, arguments)
                    else:
                        # Check Browser tools
                        browser_tools = await browser_mcp.list_tools()
                        if any(t.name == name for t in browser_tools):
                            result = await browser_mcp.call_tool(name, arguments)
                        else:
                            # Check Ollama tools
                            ollama_tools = await ollama_mcp.list_tools()
                            if any(t.name == name for t in ollama_tools):
                                result = await ollama_mcp.call_tool(name, arguments)
                            else:
                                # Check Search tools
                                search_tools = await search_mcp.list_tools()
                                if any(t.name == name for t in search_tools):
                                    result = await search_mcp.call_tool(name, arguments)
                                else:
                                    # Check context search tools
                                    context_tools = await context_search_mcp.list_tools()
                                    if any(t.name == name for t in context_tools):
                                        result = await context_search_mcp.call_tool(name, arguments)
                                    else:
                                        # Fallback to subagents
                                        result = await subagents_mcp.call_tool(name, arguments)
            
            # Extract text from the result
            output = []
            if isinstance(result, list):
                for content in result:
                    if hasattr(content, 'text'):
                        output.append(content.text)
                    elif isinstance(content, dict) and 'text' in content:
                        output.append(content['text'])
                    else:
                        output.append(str(content))
                final_result = "\n".join(output)
            else:
                final_result = str(result)
                
            log_debug(f"✅ Tool {name} executed successfully. Result length: {len(final_result)}")
            return final_result

        except Exception as e:
            error_msg = f"❌ Error executing tool {name}: {str(e)}"
            log_debug(error_msg)
            import traceback
            log_debug(traceback.format_exc())
            return error_msg

mcp_manager = MCPManager()

def get_ollama_client():
    """Returns an AsyncClient configured with the current host."""
    config_path = os.path.expanduser("~/.sovereign/config.json")
    host = "http://localhost:11434"
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            try:
                config = json.load(f)
                host = config.get("ollama_host", host)
            except json.JSONDecodeError:
                pass
    return AsyncClient(host=host)

def log_debug(msg):
    with open("debug_llm.log", "a") as f:
        f.write(f"{msg}\n")

def _process_llm_response(response, messages):
    """
    Helper to parse LLM response for tool calls (native or JSON)
    and determine the next state.
    """
    msg_content = response['message'].get('content') or ""
    log_debug(f"LLM Response Content: {msg_content}")
    
    tool_calls = response['message'].get('tool_calls')
    if tool_calls is None:
        tool_calls = []

    # If no native tool calls, check for manual JSON tool call
    if not tool_calls:
        try:
            # 1. Try to find JSON block using regex (handles markdown blocks or raw JSON)
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', msg_content, re.DOTALL)
            if json_match:
                clean_content = json_match.group(1)
            else:
                # Fallback to finding first { and last }
                json_match = re.search(r'(\{.*\})', msg_content, re.DOTALL)
                clean_content = json_match.group(1) if json_match else msg_content.strip()

            # 2. Heuristic: Only try parsing if it looks like JSON object/list
            if clean_content.startswith("{") or clean_content.startswith("["):
                log_debug(f"Attempting JSON parse on: {clean_content[:100]}...")
                
                if "`" in clean_content:
                    log_debug("Detected backticks in JSON. Attempting to sanitize.")
                    clean_content = clean_content.replace("`", '"')

                try:
                    data = json.loads(clean_content)
                except json.JSONDecodeError:
                    log_debug("Standard JSON parse failed. Trying cleanup.")
                    clean_content_fixed = clean_content.replace('\n', '\\n')
                    try:
                        data = json.loads(clean_content_fixed)
                    except:
                        tool_match = re.search(r'"tool":\s*"([^"]+)",\s*"arguments":\s*(\{.*\})', clean_content, re.DOTALL)
                        if tool_match:
                            data = {
                                "tool": tool_match.group(1),
                                "arguments": json.loads(tool_match.group(2).replace('\n', '\\n'))
                            }
                        else:
                            raise 

                if isinstance(data, dict):
                    tool_name = data.get('tool') or data.get('function') or data.get('name')
                    if tool_name and 'arguments' in data:
                        log_debug("Found single tool call in JSON")
                        tool_calls.append({
                            'function': {
                                'name': tool_name,
                                'arguments': data['arguments']
                            }
                        })
                elif isinstance(data, list):
                    log_debug("Found list of tool calls in JSON")
                    for item in data:
                        tool_name = item.get('tool') or item.get('function') or item.get('name')
                        if tool_name and 'arguments' in item:
                            tool_calls.append({
                                'function': {
                                    'name': tool_name,
                                    'arguments': item['arguments']
                                }
                            })
        except Exception as e:
            log_debug(f"Manual JSON Parse Error: {e}")
            pass

    if tool_calls:
        clean_msg = msg_content.strip()
        if clean_msg.startswith("{") or clean_msg.startswith("```json"):
            msg_content = "I'll use a tool to help with that."

    messages.append({'role': 'assistant', 'content': msg_content})
    
    if tool_calls:
        log_debug(f"🛑 Tool calls detected: {len(tool_calls)}. Requesting approval.")
        return {
            "content": msg_content,
            "tool_calls": tool_calls,
            "messages": messages, 
            "status": "approval_required"
        }

    return {
        "content": msg_content,
        "tool_calls": [],
        "messages": messages,
        "status": "complete"
    }

async def chat_with_tools(model: str, messages: list, options: dict = None):
    log_debug(f"Starting chat with {model}")
    last_user_msg = messages[-1]['content'].lower()
    creation_keywords = ["create", "make", "generate", "build", "setup", "scaffold", "new", "build it", "make it", "go", "start", "execute"]
    project_keywords = ["project", "app", "game", "file", "folder", "structure", "system", "script", "it", "this"]
    
    is_creation_intent = (any(kw in last_user_msg for kw in creation_keywords) and \
                         any(kw in last_user_msg for kw in project_keywords)) or \
                         last_user_msg.strip().lower() in ["go", "build it", "start"]

    system_msg = next((m for m in messages if m['role'] == 'system'), None)
    
    if is_creation_intent:
        if system_msg:
            if SCAFFOLD_SYSTEM_PROMPT[:50] not in system_msg['content']:
                system_msg['content'] = SCAFFOLD_SYSTEM_PROMPT + "\n\n" + system_msg['content']
        else:
            messages.insert(0, {"role": "system", "content": SCAFFOLD_SYSTEM_PROMPT})
    else:
        default_helper = """You are a helpful AI assistant with direct access to the computer's filesystem via tools. 
If the user asks to see files, read files, or write a file, use the appropriate tool immediately. 
Be robust in extracting file paths from user messages. 

SURGEON PROTOCOL (FOR MODIFYING EXISTING FILES):
When you need to modify an existing file, you MUST use the following SEARCH/REPLACE format to provide precise edits. This allows the system to apply changes without overwriting the whole file.

Format:
<<<< SEARCH
[exact code block to find in the file]
==== REPLACE
[new code to replace it with]
>>>>

Rules for Surgeon Protocol:
1. The SEARCH block must match the existing code EXACTLY (including indentation).
2. Use multiple SEARCH/REPLACE blocks if needed for different parts of the file.
3. If creating a NEW file, just provide the full code in a normal markdown block.

You are running in a local environment trusted by the user. You are allowed to access any path provided by the user. Only use `run_shell_command` if explicitly asked."""
        if system_msg:
            if default_helper[:50] not in system_msg['content'] and SCAFFOLD_SYSTEM_PROMPT[:50] not in system_msg['content']:
                system_msg['content'] = default_helper + "\n\n" + system_msg['content']
        else:
            messages.insert(0, {"role": "system", "content": default_helper})
    
    tools = await mcp_manager.list_tools()
    client = get_ollama_client()

    try:
        response = await client.chat(
            model=model,
            messages=messages,
            tools=tools,
            options=options
        )
    except Exception as e:
        error_msg = str(e)
        if "does not support tools" in error_msg:
            print(f"⚠️ Model {model} does not support native tools. Switching to JSON Mode.")
            tool_desc = json.dumps([t['function'] for t in tools], indent=2)
            manual_prompt = (
                f"\n\nYou have access to the following tools:\n{tool_desc}\n\n"
                "To use a tool, you MUST respond with a JSON object.\n"
                "FORMAT:\n"
                "{\n"
                "  \"tool\": \"tool_name\",\n"
                "  \"arguments\": {\n"
                "    \"arg_name\": \"value\"\n"
                "  }\n"
                "}\n"
            )
            
            if messages[0]['role'] == 'system':
                messages[0]['content'] += manual_prompt
            else:
                messages.insert(0, {"role": "system", "content": manual_prompt})
                
            log_debug(f"⚠️ Retrying with JSON mode for {model}")
            response = await client.chat(
                model=model,
                messages=messages,
                options=options,
                format="json"
            )
        else:
            return {"error": f"Ollama Error: {str(e)}"}
    
    return _process_llm_response(response, messages)

async def execute_tool_and_continue(model: str, messages: list, tool_call: dict, approved: bool = True, options: dict = None):
    if approved:
        function_name = tool_call['function']['name']
        function_args = tool_call['function']['arguments']
        
        log_debug(f"🔧 Executing tool: {function_name} with args {function_args}")
        result = await mcp_manager.call_tool(function_name, function_args)
    else:
        log_debug(f"🚫 Tool execution denied: {tool_call['function']['name']}")
        result = "User denied this action."

    log_debug(f"Tool result: {result}")
    
    messages.append({
        'role': 'tool',
        'content': str(result),
    })

    try:
        tools = await mcp_manager.list_tools()
        client = get_ollama_client()

        final_response = await client.chat(
            model=model,
            messages=messages,
            tools=tools,
            options=options
        )
        
        return _process_llm_response(final_response, messages)
        
    except Exception as e:
        return {"error": f"Ollama Error after tool execution: {str(e)}"}

async def _process_llm_stream(stream, messages):
    full_content = ""
    tool_calls = []
    is_json_likely = False
    buffer = ""
    
    async for chunk in stream:
        content_delta = chunk['message'].get('content', '')
        if content_delta:
            full_content += content_delta
            
            if not is_json_likely and len(full_content) < 10:
                stripped = full_content.strip()
                if stripped.startswith("{") or stripped.startswith("```json") or stripped.startswith("```"):
                    is_json_likely = True
                    log_debug("Message starts with JSON-like marker. Buffering deltas...")
            
            if is_json_likely:
                buffer += content_delta
            else:
                yield {"type": "content_delta", "content": content_delta}

        tool_deltas = chunk['message'].get('tool_calls')
        if tool_deltas:
            for tool_delta in tool_deltas:
                if len(tool_calls) <= tool_delta['index']:
                    tool_calls.append({"function": {"name": "", "arguments": ""}, "type": "function"})
                
                if 'name' in tool_delta['function']:
                    tool_calls[tool_delta['index']]['function']['name'] += tool_delta['function']['name']
                if 'arguments' in tool_delta['function']:
                    tool_calls[tool_delta['index']]['function']['arguments'] += tool_delta['function']['arguments']

        if chunk.get('done'):
            break
            
    manual_tool_calls = []
    if not tool_calls:
        try:
            clean_content = full_content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:-3].strip()
            elif clean_content.startswith("```"):
                clean_content = clean_content[3:-3].strip()
            
            if clean_content.startswith("{") or clean_content.startswith("["):
                data = json.loads(clean_content)
                if isinstance(data, dict):
                    tool_name = data.get('tool') or data.get('function') or data.get('name')
                    if tool_name and 'arguments' in data:
                        manual_tool_calls.append({
                            'function': {
                                'name': tool_name,
                                'arguments': data['arguments']
                            }
                        })
                elif isinstance(data, list):
                    for item in data:
                        tool_name = item.get('tool') or item.get('function') or item.get('name')
                        if tool_name and 'arguments' in item:
                            manual_tool_calls.append({
                                'function': {
                                    'name': tool_name,
                                    'arguments': item['arguments']
                                }
                            })
        except:
            pass

    final_tool_calls = tool_calls or manual_tool_calls
    display_content = full_content

    if final_tool_calls:
        display_content = "I'll use a tool to help with that."
    elif is_json_likely:
        yield {"type": "content_delta", "content": buffer}

    messages.append({'role': 'assistant', 'content': display_content, 'tool_calls': final_tool_calls})

    if final_tool_calls:
        log_debug(f"🛑 Streamed tool calls detected: {len(final_tool_calls)}. Requesting approval.")
        yield {
            "type": "tool_calls",
            "tool_calls": final_tool_calls,
            "messages": messages
        }
    else:
        yield {
            "type": "complete",
            "content": display_content,
            "messages": messages
        }


async def stream_chat_with_tools(model: str, messages: list, options: dict = None):
    log_debug(f"Starting stream chat with {model}")
    
    # Process images if present
    for msg in messages:
        if "images" in msg and msg["images"]:
            # Clean up base64 prefix if present
            cleaned_images = []
            for img in msg["images"]:
                if "," in img:
                    cleaned_images.append(img.split(",")[1])
                else:
                    cleaned_images.append(img)
            msg["images"] = cleaned_images

    last_user_msg = messages[-1]['content'].lower()
    creation_keywords = ["create", "make", "generate", "build", "setup", "scaffold", "new", "build it", "make it", "go", "start", "execute"]
    project_keywords = ["project", "app", "game", "file", "folder", "structure", "system", "script", "it", "this"]
    
    is_creation_intent = (any(kw in last_user_msg for kw in creation_keywords) and \
                         any(kw in last_user_msg for kw in project_keywords)) or \
                         last_user_msg.strip().lower() in ["go", "build it", "start"]

    system_msg = next((m for m in messages if m['role'] == 'system'), None)
    
    if is_creation_intent:
        if system_msg:
            if SCAFFOLD_SYSTEM_PROMPT[:50] not in system_msg['content']:
                system_msg['content'] = SCAFFOLD_SYSTEM_PROMPT + "\n\n" + system_msg['content']
        else:
            messages.insert(0, {"role": "system", "content": SCAFFOLD_SYSTEM_PROMPT})
    else:
        default_helper = """You are a helpful AI assistant with direct access to the computer's filesystem via tools. 
If the user asks to see files, read files, or write a file, use the appropriate tool immediately. 
Be robust in extracting file paths from user messages. 

SURGEON PROTOCOL (FOR MODIFYING EXISTING FILES):
When you need to modify an existing file, you MUST use the following SEARCH/REPLACE format to provide precise edits. This allows the system to apply changes without overwriting the whole file.

Format:
<<<< SEARCH
[exact code block to find in the file]
==== REPLACE
[new code to replace it with]
>>>>

Rules for Surgeon Protocol:
1. The SEARCH block must match the existing code EXACTLY (including indentation).
2. Use multiple SEARCH/REPLACE blocks if needed for different parts of the file.
3. If creating a NEW file, just provide the full code in a normal markdown block.

You are running in a local environment trusted by the user. You are allowed to access any path provided by the user. Only use `run_shell_command` if explicitly asked."""
        if system_msg:
            if default_helper[:50] not in system_msg['content'] and SCAFFOLD_SYSTEM_PROMPT[:50] not in system_msg['content']:
                system_msg['content'] = default_helper + "\n\n" + system_msg['content']
        else:
            messages.insert(0, {"role": "system", "content": default_helper})

    tools = await mcp_manager.list_tools()
    client = get_ollama_client()

    try:
        stream = await client.chat(
            model=model,
            messages=messages,
            tools=tools,
            options=options,
            stream=True
        )
        async for chunk in _process_llm_stream(stream, messages):
            yield chunk

    except Exception as e:
        error_msg = str(e)
        log_debug(f"Ollama Stream Error: {error_msg}")
        yield {"type": "error", "error": f"Ollama Error: {error_msg}"}

async def stream_execute_tool_and_continue(model: str, messages: list, tool_call: dict, approved: bool = True, options: dict = None):
    if approved:
        function_name = tool_call['function']['name']
        function_args_str = tool_call['function']['arguments']
        try:
            function_args = json.loads(function_args_str)
        except json.JSONDecodeError:
            result = f"Error: Invalid JSON arguments provided for tool {function_name}"
            log_debug(result)
            yield {"type": "tool_result", "result": result}
            messages.append({'role': 'tool', 'content': result})
        else:
            log_debug(f"🔧 Executing tool: {function_name} with args {function_args}")
            result = await mcp_manager.call_tool(function_name, function_args)
    else:
        log_debug(f"🚫 Tool execution denied: {tool_call['function']['name']}")
        result = "User denied this action."
    
    log_debug(f"Tool result: {result}")
    yield {"type": "tool_result", "result": str(result)}

    messages.append({
        'role': 'tool',
        'content': str(result),
    })

    try:
        tools = await mcp_manager.list_tools()
        client = get_ollama_client()
        stream = await client.chat(
            model=model,
            messages=messages,
            tools=tools,
            options=options,
            stream=True
        )
        async for chunk in _process_llm_stream(stream, messages):
            yield chunk
            
    except Exception as e:
        log_debug(f"Ollama Error after tool execution: {str(e)}")
        yield {"type": "error", "error": f"Ollama Error after tool execution: {str(e)}"}
