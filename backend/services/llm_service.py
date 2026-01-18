import asyncio
import json
from ollama import AsyncClient
from config import SCAFFOLD_SYSTEM_PROMPT
from mcp_server.filesystem import mcp as filesystem_mcp
from mcp_server.command import mcp as terminal_mcp
from mcp_server.github import mcp as github_mcp
from mcp_server.search import mcp as search_mcp
from mcp_server.browser import mcp as browser_mcp
from mcp_server.git import mcp as git_mcp

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
        git_tools = await git_mcp.list_tools()
        all_tools = fs_tools + term_tools + gh_tools + search_tools + browser_tools + git_tools
        
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
                            # Check Git tools
                            git_tools = await git_mcp.list_tools()
                            if any(t.name == name for t in git_tools):
                                result = await git_mcp.call_tool(name, arguments)
                            else:
                                # Check Search tools
                                result = await search_mcp.call_tool(name, arguments)
            
            # Extract text from the result
            output = []
            if isinstance(result, list):
                for content in result:
                    if hasattr(content, 'text'):
                        output.append(content.text)
                    else:
                        output.append(str(content))
                return "\n".join(output)
            return str(result)

        except Exception as e:
            return f"Error executing tool {name}: {str(e)}"

mcp_manager = MCPManager()
client = AsyncClient()

def log_debug(msg):
    with open("debug_llm.log", "a") as f:
        f.write(f"{msg}\n")

def _process_llm_response(response, messages):
    """
    Helper to parse LLM response for tool calls (native or JSON)
    and determine the next state.
    """
    msg_content = response['message']['content']
    log_debug(f"LLM Response Content: {msg_content}")
    
    tool_calls = response['message'].get('tool_calls')
    if tool_calls is None:
        tool_calls = []

    # If no native tool calls, check for manual JSON tool call
    if not tool_calls:
        try:
            # Clean content (sometimes models add markdown code blocks)
            clean_content = msg_content.strip()
            if clean_content.startswith("```json"):
                clean_content = clean_content[7:-3].strip()
            elif clean_content.startswith("```"):
                clean_content = clean_content[3:-3].strip()
            
            # Heuristic: Only try parsing if it looks like JSON object/list
            if clean_content.startswith("{") or clean_content.startswith("["):
                log_debug(f"Attempting JSON parse on: {clean_content}")
                data = json.loads(clean_content)
                
                # Normalize single tool call vs list of calls
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
        except json.JSONDecodeError:
            log_debug("JSON Decode Error")
            pass
        except Exception as e:
            log_debug(f"Error parsing manual JSON tool call: {e}")

    # CLEANUP: If we found tool calls and the content is primarily just the JSON,
    # we should hide it from the user to avoid cluttering the chat.
    if tool_calls:
        # Check if content is mostly just the JSON block
        clean_msg = msg_content.strip()
        if clean_msg.startswith("{") or clean_msg.startswith("```json"):
            # It's a pure tool call, let's give it a nicer placeholder content
            # The UI will show the tool call card anyway.
            msg_content = "I'll use a tool to help with that."

    messages.append({'role': 'assistant', 'content': msg_content})
    
    # Check for recursion/loop (STOP condition)
    if tool_calls:
        log_debug(f"🛑 Tool calls detected: {len(tool_calls)}. Requesting approval.")
        return {
            "content": msg_content,
            "tool_calls": tool_calls,
            "messages": messages, # Return updated history
            "status": "approval_required"
        }

    # If no tools, just return the content
    return {
        "content": msg_content,
        "tool_calls": [],
        "messages": messages,
        "status": "complete"
    }

async def chat_with_tools(model: str, messages: list, options: dict = None):
    log_debug(f"Starting chat with {model}")
    """
    Enhanced chat handler that supports tool calling and 
    specialized scaffolding persona.
    """
    # ... (intent detection code stays the same) ...
    last_user_msg = messages[-1]['content'].lower()
    creation_keywords = ["create", "make", "generate", "build", "setup", "scaffold", "new"]
    project_keywords = ["project", "app", "game", "file", "folder", "structure", "system", "script"]
    
    is_creation_intent = any(kw in last_user_msg for kw in creation_keywords) and \
                         any(kw in last_user_msg for kw in project_keywords)

    # Check if system prompt is already set
    has_system = messages[0]['role'] == 'system' if messages else False

    if is_creation_intent and not has_system:
        # Inject the Architect Persona at the start
        messages.insert(0, {"role": "system", "content": SCAFFOLD_SYSTEM_PROMPT})
    elif not has_system:
        # General helper persona if not specifically creating
        messages.insert(0, {"role": "system", "content": "You are a helpful AI assistant with direct access to the computer's filesystem via tools. If the user asks to see files, read files, or write a file, use the appropriate tool immediately. Do not explain that you are using a tool, just do it. Only use `run_shell_command` if the user explicitly asks to run a terminal command or script. Do not interpret conversational questions (like 'is it ready?') as shell commands. You are restricted to the current project directory. Do not attempt to access or modify files outside this folder (e.g. do not access /home/user/, /etc/, or system paths)."})
    
    # 2. Get Tools (Now includes scaffold_project)
    tools = await mcp_manager.list_tools()

    # 3. Call Ollama
    try:
        response = await client.chat(
            model=model,
            messages=messages,
            tools=tools,
            options=options
        )
    except Exception as e:
        error_msg = str(e)
        # If model doesn't support tools (400 error), fallback to manual JSON parsing
        if "does not support tools" in error_msg:
            print(f"⚠️ Model {model} does not support native tools. Switching to JSON Mode.")
            
            # Manually inject tool definitions into system prompt
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
            
            # Update system prompt
            if messages[0]['role'] == 'system':
                messages[0]['content'] += manual_prompt
            else:
                messages.insert(0, {"role": "system", "content": manual_prompt})
                
            # Retry without 'tools' arg
            log_debug(f"⚠️ Retrying with JSON mode for {model}")
            response = await client.chat(
                model=model,
                messages=messages,
                options=options,
                format="json" # Force JSON mode for better parsing
            )
        else:
            return {"error": f"Ollama Error: {str(e)}"}
    
    # 4. Process Response
    return _process_llm_response(response, messages)

async def execute_tool_and_continue(model: str, messages: list, tool_call: dict, approved: bool = True, options: dict = None):
    """
    Executes a specific tool (if approved) and continues the chat.
    This enables the Agentic Loop: Output -> Tool -> Output -> Tool...
    """
    if approved:
        function_name = tool_call['function']['name']
        function_args = tool_call['function']['arguments']
        
        log_debug(f"🔧 Executing tool: {function_name} with args {function_args}")
        result = await mcp_manager.call_tool(function_name, function_args)
    else:
        log_debug(f"🚫 Tool execution denied: {tool_call['function']['name']}")
        result = "User denied this action."

    log_debug(f"Tool result: {result}")
    
    # Append the tool result to history
    messages.append({
        'role': 'tool',
        'content': str(result),
    })

    # Call Ollama again to get the final (or next) response
    try:
        # We need to re-fetch tools in case the model wants to call another one
        tools = await mcp_manager.list_tools()

        final_response = await client.chat(
            model=model,
            messages=messages,
            tools=tools, # Pass tools again for recursion
            options=options
        )
        
        # Process the new response - this triggers the loop if it wants to call another tool
        return _process_llm_response(final_response, messages)
        
    except Exception as e:
        return {"error": f"Ollama Error after tool execution: {str(e)}"}

async def _process_llm_stream(stream, messages, rag_service):
    full_content = ""
    tool_calls = []
    is_json_likely = False
    buffer = ""
    
    async for chunk in stream:
        content_delta = chunk['message'].get('content', '')
        if content_delta:
            full_content += content_delta
            
            # HEURISTIC: If the first characters look like JSON, stop yielding deltas
            # and buffer them. If it turns out NOT to be a tool call, we'll yield the buffer.
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
            
    # POST-STREAM PROCESSING
    # If we buffered JSON and it turned out to NOT have native tool calls, 
    # check if we can parse it as a manual tool call.
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
        # It's a tool call! Use a placeholder and suppress the buffer
        display_content = "I'll use a tool to help with that."
    elif is_json_likely:
        # Not a tool call, but we buffered it. Yield the whole buffer now.
        yield {"type": "content_delta", "content": buffer}

    messages.append({'role': 'assistant', 'content': display_content, 'tool_calls': final_tool_calls})

    # Index the chat turn if it was a standard response
    if not final_tool_calls and rag_service:
        user_message = next((m['content'] for m in reversed(messages) if m['role'] == 'user'), None)
        if user_message and display_content:
            await rag_service.index_chat_turn(user_message, display_content)

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


async def stream_chat_with_tools(model: str, messages: list, rag_service, options: dict = None):
    log_debug(f"Starting stream chat with {model}")
    # Persona injection logic...
    last_user_msg = messages[-1]['content'].lower()
    creation_keywords = ["create", "make", "generate", "build", "setup", "scaffold", "new"]
    project_keywords = ["project", "app", "game", "file", "folder", "structure", "system", "script"]
    
    is_creation_intent = any(kw in last_user_msg for kw in creation_keywords) and \
                         any(kw in last_user_msg for kw in project_keywords)

    has_system = messages and messages[0]['role'] == 'system'
    if is_creation_intent and not has_system:
        messages.insert(0, {"role": "system", "content": SCAFFOLD_SYSTEM_PROMPT})
    elif not has_system:
        messages.insert(0, {"role": "system", "content": "You are a helpful AI assistant..."})

    tools = await mcp_manager.list_tools()

    try:
        stream = await client.chat(
            model=model,
            messages=messages,
            tools=tools,
            options=options,
            stream=True
        )
        async for chunk in _process_llm_stream(stream, messages, rag_service):
            yield chunk

    except Exception as e:
        error_msg = str(e)
        # Basic error handling for streaming
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
            # Fall through to let the model comment on the error
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
