from mcp.server.fastmcp import FastMCP
import httpx
import os
import json
from typing import Optional, List, Dict, Any

mcp = FastMCP("LocalDev GitHub")

GITHUB_API_URL = "https://api.github.com"

def _get_headers() -> Dict[str, str]:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise ValueError("GITHUB_TOKEN environment variable is not set. Please set it in your .env file.")
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }

@mcp.tool()
async def github_list_issues(owner: str, repo: str, state: str = "open") -> str:
    """
    List issues for a GitHub repository.
    
    Args:
        owner: The account owner of the repository.
        repo: The name of the repository.
        state: The state of the issues to return (open, closed, all). Default: open.
    """
    try:
        headers = _get_headers()
    except ValueError as e:
        return f"❌ Error: {str(e)}"
        
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/issues"
    params = {"state": state}
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            issues = response.json()
            
            if not issues:
                return f"No {state} issues found for {owner}/{repo}."
            
            result = []
            for issue in issues:
                # Skip pull requests which are also returned in issues endpoint
                if "pull_request" in issue:
                    continue
                result.append(f"#{issue['number']} {issue['title']} (State: {issue['state']})")
            
            return "\n".join(result)
            
        except httpx.HTTPStatusError as e:
            return f"❌ GitHub API Error: {e.response.status_code} - {e.response.text}"
        except Exception as e:
            return f"❌ Error listing issues: {str(e)}"

@mcp.tool()
async def github_create_issue(owner: str, repo: str, title: str, body: str = "") -> str:
    """
    Create a new issue in a GitHub repository.
    
    Args:
        owner: The account owner of the repository.
        repo: The name of the repository.
        title: The title of the issue.
        body: The body content of the issue.
    """
    try:
        headers = _get_headers()
    except ValueError as e:
        return f"❌ Error: {str(e)}"
        
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/issues"
    data = {"title": title, "body": body}
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=data)
            response.raise_for_status()
            issue = response.json()
            return f"✅ Issue created: {issue['html_url']}"
            
        except httpx.HTTPStatusError as e:
            return f"❌ GitHub API Error: {e.response.status_code} - {e.response.text}"
        except Exception as e:
            return f"❌ Error creating issue: {str(e)}"

@mcp.tool()
async def github_create_pull_request(owner: str, repo: str, title: str, head: str, base: str, body: str = "") -> str:
    """
    Create a pull request.
    
    Args:
        owner: The account owner of the repository.
        repo: The name of the repository.
        title: The title of the pull request.
        head: The name of the branch where your changes are implemented.
        base: The name of the branch you want the changes pulled into.
        body: The contents of the pull request.
    """
    try:
        headers = _get_headers()
    except ValueError as e:
        return f"❌ Error: {str(e)}"
        
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/pulls"
    data = {
        "title": title,
        "head": head,
        "base": base,
        "body": body
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=data)
            response.raise_for_status()
            pr = response.json()
            return f"✅ Pull Request created: {pr['html_url']}"
            
        except httpx.HTTPStatusError as e:
            return f"❌ GitHub API Error: {e.response.status_code} - {e.response.text}"
        except Exception as e:
            return f"❌ Error creating PR: {str(e)}"

@mcp.tool()
async def github_get_file_content(owner: str, repo: str, path: str, ref: str = "main") -> str:
    """
    Get the content of a file from a GitHub repository.
    
    Args:
        owner: The account owner of the repository.
        repo: The name of the repository.
        path: The path to the file.
        ref: The name of the commit/branch/tag. Default: main.
    """
    try:
        headers = _get_headers()
    except ValueError as e:
        return f"❌ Error: {str(e)}"
        
    url = f"{GITHUB_API_URL}/repos/{owner}/{repo}/contents/{path}"
    params = {"ref": ref}
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()
            content_data = response.json()
            
            if "content" not in content_data:
                return f"❌ Error: Response does not contain content. Is it a directory?"
            
            import base64
            content = base64.b64decode(content_data["content"]).decode("utf-8")
            return content
            
        except httpx.HTTPStatusError as e:
            return f"❌ GitHub API Error: {e.response.status_code} - {e.response.text}"
        except Exception as e:
            return f"❌ Error reading file: {str(e)}"

if __name__ == "__main__":
    mcp.run()
