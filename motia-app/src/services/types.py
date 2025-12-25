from pydantic import BaseModel
from enum import Enum
from typing import List, Dict, Any

class OrderStatus(str, Enum):
    PLACED = "placed"
    APPROVED = "approved"
    DELIVERED = "delivered"

class Pet(BaseModel):
    id: str
    name: str
    photoUrl: str

class Order(BaseModel):
    id: str
    quantity: int
    petId: str
    shipDate: str
    status: OrderStatus
    complete: bool

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model: str
    messages: List[Dict[str, str]]

class GenerateEmbeddingRequest(BaseModel):
    text: str

class IndexFileRequest(BaseModel):
    file_path: str
    content: str

class GetContextRequest(BaseModel):
    query: str
    current_file: str | None = None

class FileOperationRequest(BaseModel):
    path: str

class WriteFileRequest(FileOperationRequest):
    content: str
