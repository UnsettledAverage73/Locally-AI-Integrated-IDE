from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import sys

# Import the search tool logic directly
# We need to make sure backend is in path if running as module
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.mcp_server.search import search_filenames, search_text

router = APIRouter()

class SearchRequest(BaseModel):
    query: str
    path: str = "."

class SearchResult(BaseModel):
    results: str

@router.post("/filenames")
async def search_filenames_api(request: SearchRequest):
    try:
        results = search_filenames(request.query, request.path)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/text")
async def search_text_api(request: SearchRequest):
    try:
        results = search_text(request.query, request.path)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
