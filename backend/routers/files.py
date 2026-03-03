import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class FileNode(BaseModel):
    name: str
    path: str
    isDirectory: bool
    children: Optional[List['FileNode']] = None

@router.get("/files/tree")
def get_file_tree(root_path: str, max_depth: int = 2):
    """
    Scans the directory tree recursively with a depth limit.
    """
    if not os.path.exists(root_path):
        raise HTTPException(status_code=404, detail="Directory not found")

    def scan(dir_path, current_depth):
        if current_depth > max_depth:
            return None
            
        tree = []
        try:
            # Sort entries: directories first, then files alphabetically
            entries = sorted(list(os.scandir(dir_path)), key=lambda e: (not e.is_dir(), e.name.lower()))
            
            for entry in entries:
                if entry.name.startswith('.') or entry.name == 'node_modules' or entry.name == '__pycache__':
                    continue
                
                node = {
                    "name": entry.name,
                    "path": entry.path,
                    "isDirectory": entry.is_dir()
                }
                if entry.is_dir():
                    children = scan(entry.path, current_depth + 1)
                    if children is not None:
                        node["children"] = children
                tree.append(node)
        except PermissionError:
            pass
        return tree

    return scan(root_path, 0)
