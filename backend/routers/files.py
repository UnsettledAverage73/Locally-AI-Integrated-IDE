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
def get_file_tree(root_path: str):
    """
    Scalable: Scans only the top level. 
    For true scalability, you would add a 'depth' param 
    and fetch subfolders only when the user clicks them.
    """
    if not os.path.exists(root_path):
        raise HTTPException(status_code=404, detail="Directory not found")

    def scan(dir_path):
        tree = []
        try:
            for entry in os.scandir(dir_path):
                if entry.name.startswith('.') or entry.name == 'node_modules':
                    continue # Skip junk for speed
                
                node = {
                    "name": entry.name,
                    "path": entry.path,
                    "isDirectory": entry.is_dir()
                }
                if entry.is_dir():
                    # Recursive for now (Limit depth for large projects if needed)
                    node["children"] = scan(entry.path) 
                tree.append(node)
        except PermissionError:
            pass
        return tree

    return scan(root_path)
