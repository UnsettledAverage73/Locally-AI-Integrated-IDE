from mcp.server.fastmcp import FastMCP
import httpx
from bs4 import BeautifulSoup
import json

mcp = FastMCP("LocalDev Browser")

@mcp.tool()
async def fetch_url(url: str) -> str:
    """
    Fetches the content of a URL and returns the text.
    
    Args:
        url: The URL to fetch.
    """
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.decompose()
                
            # Get text
            text = soup.get_text()
            
            # Break into lines and remove leading and trailing whitespace
            lines = (line.strip() for line in text.splitlines())
            # Break multi-headlines into a line each
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            # Drop blank lines
            text = '\n'.join(chunk for chunk in chunks if chunk)
            
            return f"--- Content from {url} ---\n\n{text[:5000]}..." if len(text) > 5000 else f"--- Content from {url} ---\n\n{text}"
            
    except Exception as e:
        return f"❌ Error fetching URL {url}: {str(e)}"

@mcp.tool()
async def google_search(query: str) -> str:
    """
    Performs a simple Google search and returns results.
    
    Args:
        query: The search query.
    """
    try:
        url = f"https://www.google.com/search?q={httpx.utils.quote(query)}"
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            results = []
            # Find all search result blocks
            for g in soup.find_all('div', class_='g'):
                anchors = g.find_all('a')
                if anchors:
                    link = anchors[0]['href']
                    title = g.find('h3').text if g.find('h3') else "No title"
                    snippet = g.find('div', class_='VwiC3b').text if g.find('div', class_='VwiC3b') else ""
                    results.append({"title": title, "link": link, "snippet": snippet})
            
            if not results:
                # Fallback for simpler markup if class 'g' isn't found
                for item in soup.find_all('div', class_='tF2Cxc'):
                    link = item.find('a')['href']
                    title = item.find('h3').text
                    results.append({"title": title, "link": link})

            if not results:
                return "No results found or markup changed."
                
            output = [f"Search results for: {query}\n"]
            for i, res in enumerate(results[:5]):
                output.append(f"{i+1}. {res['title']}\n   {res['link']}\n   {res.get('snippet', '')}\n")
                
            return "\n".join(output)
            
    except Exception as e:
        return f"❌ Error performing search: {str(e)}"

if __name__ == "__main__":
    mcp.run()
