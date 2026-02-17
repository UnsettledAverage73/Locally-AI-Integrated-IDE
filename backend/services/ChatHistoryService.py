import sqlite3
import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Optional

class ChatHistoryService:
    def __init__(self, db_path=None):
        if db_path is None:
            home_dir = os.path.expanduser("~")
            base_dir = os.path.join(home_dir, ".average")
            os.makedirs(base_dir, exist_ok=True)
            db_path = os.path.join(base_dir, "chat_history.db")

        self.db_path = db_path
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.create_tables()

    def create_tables(self):
        with self.conn:
            # Sessions table
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    title TEXT,
                    created_at DATETIME,
                    updated_at DATETIME,
                    model TEXT,
                    summary TEXT
                )
            """)
            # Messages table
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    role TEXT,
                    content TEXT,
                    timestamp DATETIME,
                    type TEXT, -- 'text', 'tool_call', 'tool_result'
                    metadata TEXT, -- JSON blob for tool calls etc.
                    FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
                )
            """)
            # Memories table
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS memories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT,
                    category TEXT, 
                    created_at DATETIME,
                    source_session_id TEXT,
                    FOREIGN KEY(source_session_id) REFERENCES sessions(id)
                )
            """)

    def create_session(self, title: str = "New Chat", model: str = "qwen2.5:0.5b") -> str:
        session_id = str(uuid.uuid4())
        now = datetime.now()
        with self.conn:
            self.conn.execute(
                "INSERT INTO sessions (id, title, created_at, updated_at, model) VALUES (?, ?, ?, ?, ?)",
                (session_id, title, now, now, model)
            )
        return session_id

    def list_sessions(self) -> List[Dict]:
        cursor = self.conn.execute("SELECT * FROM sessions ORDER BY updated_at DESC")
        return [dict(row) for row in cursor.fetchall()]

    def get_session(self, session_id: str) -> Optional[Dict]:
        cursor = self.conn.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
        row = cursor.fetchone()
        if not row:
            return None
        
        session = dict(row)
        cursor = self.conn.execute(
            "SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp ASC",
            (session_id,)
        )
        session["messages"] = [dict(r) for r in cursor.fetchall()]
        return session

    def add_message(self, session_id: str, role: str, content: str, msg_type: str = "text", metadata: Dict = None):
        now = datetime.now()
        metadata_json = json.dumps(metadata) if metadata else None
        with self.conn:
            self.conn.execute(
                "INSERT INTO messages (session_id, role, content, timestamp, type, metadata) VALUES (?, ?, ?, ?, ?, ?)",
                (session_id, role, content, now, msg_type, metadata_json)
            )
            self.conn.execute(
                "UPDATE sessions SET updated_at = ? WHERE id = ?",
                (now, session_id)
            )

    def update_session_title(self, session_id: str, title: str):
        with self.conn:
            self.conn.execute(
                "UPDATE sessions SET title = ? WHERE id = ?",
                (title, session_id)
            )

    def delete_session(self, session_id: str):
        with self.conn:
            self.conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))

    def add_memory(self, content: str, category: str, session_id: str):
        with self.conn:
            self.conn.execute(
                "INSERT INTO memories (content, category, created_at, source_session_id) VALUES (?, ?, ?, ?)",
                (content, category, datetime.now(), session_id)
            )

    def get_memories(self) -> List[Dict]:
        cursor = self.conn.execute("SELECT * FROM memories ORDER BY created_at DESC")
        return [dict(row) for row in cursor.fetchall()]

history_service = ChatHistoryService()
