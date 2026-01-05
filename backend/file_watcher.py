from watchdog.observers import Observer
from watchdog.events import RegexMatchingEventHandler
import asyncio
import os

class IDEEventHandler(RegexMatchingEventHandler):
    def __init__(self, loop, broadcast_func):
        # Ignore common heavy directories and files
        # Regexes are matched against the full path
        ignore_regex = [
            r".*[/\\]node_modules[/\\]",
            r".*[/\\]\.git[/\\]",
            r".*[/\\]\.gemini[/\\]",
            r".*[/\\]__pycache__[/\\]",
            r".*[/\\]venv[/\\]",
            r".*[/\\]dist[/\\]",
            r".*[/\\]build[/\\]",
            r".*\.DS_Store",
        ]
        super().__init__(ignore_regexes=ignore_regex)
        self.loop = loop
        self.broadcast_func = broadcast_func

    def on_modified(self, event):
        if event.is_directory: return
        
        # Double check ignore (watchdog regex isn't always perfect on all OS)
        path = event.src_path
        if any(x in path for x in ['node_modules', '.git', '__pycache__', 'venv', '.gemini']):
            return

        # print(f"File changed: {path}")
        if self.loop and self.broadcast_func:
            asyncio.run_coroutine_threadsafe(
                self.broadcast_func({"type": "file_change", "path": path}),
                self.loop
            )

def start_watcher(path, loop, broadcast_func):
    observer = Observer()
    event_handler = IDEEventHandler(loop, broadcast_func)
    observer.schedule(event_handler, path, recursive=True)
    observer.start()
    return observer
