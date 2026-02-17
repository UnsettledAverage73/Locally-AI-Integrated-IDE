from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from services.ChatHistoryService import history_service

router = APIRouter()

class SessionUpdateRequest(BaseModel):
    title: str

@router.get("/sessions", summary="List all chat sessions")
async def list_sessions():
    return history_service.list_sessions()

@router.post("/sessions", summary="Create a new chat session")
async def create_session():
    session_id = history_service.create_session()
    return {"session_id": session_id}

@router.get("/sessions/{session_id}", summary="Get a specific chat session with messages")
async def get_session(session_id: str):
    session = history_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.put("/sessions/{session_id}", summary="Update a session's title")
async def update_session(session_id: str, request: SessionUpdateRequest):
    history_service.update_session_title(session_id, request.title)
    return {"status": "success"}

@router.delete("/sessions/{session_id}", summary="Delete a chat session")
async def delete_session(session_id: str):
    history_service.delete_session(session_id)
    return {"status": "success"}
