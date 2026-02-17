import sqlite3
import time
import json
import os
from datetime import datetime

class TelemetryService:
    def __init__(self, db_path=None):
        if db_path is None:
            # Use user's home directory to avoid permission issues in /tmp or program files
            home_dir = os.path.expanduser("~")
            base_dir = os.path.join(home_dir, ".localdev")
            os.makedirs(base_dir, exist_ok=True)
            db_path = os.path.join(base_dir, "llm_ops.db")

        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self.create_tables()

    def create_tables(self):
        # We store the inputs, outputs, latency, and cost for every call
        query = """
        CREATE TABLE IF NOT EXISTS traces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME,
            feature_name TEXT,    -- e.g., "chat", "git_agent"
            model_name TEXT,      -- e.g., "qwen2.5:0.5b"
            prompt_tokens INTEGER,
            completion_tokens INTEGER,
            latency_ms REAL,
            input_context TEXT,   -- The actual prompt we sent
            output_response TEXT, -- What the AI said
            success BOOLEAN
        )
        """
        self.conn.execute(query)
        self.conn.commit()

    def log_trace(self, feature, model, start_time, input_text, output_text, success=True):
        latency = (time.time() - start_time) * 1000
        # Estimate tokens (Rough rule: 1 token ~= 4 chars)
        p_tokens = len(input_text) / 4
        c_tokens = len(output_text) / 4
        
        self.conn.execute(
            "INSERT INTO traces (timestamp, feature_name, model_name, prompt_tokens, completion_tokens, latency_ms, input_context, output_response, success) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (datetime.now(), feature, model, p_tokens, c_tokens, latency, input_text, output_text, success)
        )
        self.conn.commit()
        print(f"📊 [LLMOps] Logged trace for {feature}: {latency:.0f}ms")
    def get_stats(self):
        query = "SELECT avg(latency_ms), count(*), sum(case when success = 0 then 1 else 0 end) FROM traces"
        cursor = self.conn.cursor()
        cursor.execute(query)
        avg_latency, total_requests, failed_requests = cursor.fetchone()
        
        # Handle case with no data
        if total_requests is None or total_requests == 0:
            return {
                "avg_latency": 0,
                "total_requests": 0,
                "error_rate": 0,
                "estimated_cost_saved": 0
            }

        failed_requests = failed_requests or 0

        # Calculate error rate
        error_rate = (failed_requests / total_requests) * 100 if total_requests > 0 else 0
        
        # Estimate cost saved (this is a mock value)
        # Assuming $0.002 / 1K tokens for a cheap model vs $0.03 / 1K for GPT-4
        # And an average of 500 tokens per request
        cost_saved = (total_requests * 500 / 1000) * (0.03 - 0.002)

        return {
            "avg_latency": avg_latency,
            "total_requests": total_requests,
            "error_rate": error_rate,
            "estimated_cost_saved": cost_saved
        }

# Singleton instance
telemetry = TelemetryService()