# LocalDev CLI (`ld`)

A terminal-first interface for the LocalDev IDE, providing local AI assistance, codebase intelligence, and autonomous development capabilities.

## Installation

```bash
cd localdev-cli
npm install
npm run build
npm link # This will make the 'ld' command available globally
```

## Prerequisites

- **LocalDev Backend**: Must be running on `http://localhost:8000`. Start it with `npm start` in the project root.
- **Ollama**: Must be running locally for AI features.

## Commands

- `ld` (no arguments): Starts the rich interactive shell with RAG context and persistent state.
- `ld do <task>`: Run a fully autonomous task (AGI mode). The agent will plan and execute steps (files, git, terminal) until the task is complete.
- `ld review`: Perform an autonomous workspace-wide review.
- `ld chat [prompt]`: Start a quick chat session.
- `ld model list`: List available Ollama models.
- `ld model show <name>`: Show detailed parameters and modelfile info.
- `ld cloud login`: Connect to AWS Bedrock for cloud-scale inference.
- `ld cloud status`: List your LocalDev cloud instances.
- `ld status`: Check backend health and system resource usage.
- `ld scaffold <prompt>`: Generate a new project structure using the Genesis Protocol.
- `ld git status`: View staged/unstaged changes.
- `ld git commit`: Generate an AI commit message and commit staged changes.
- `ld index [path]`: Index a directory for semantic search and RAG.
- `ld search <query>`: Perform semantic search across the indexed codebase.
- `ld ralph start [dir]`: Start an autonomous development loop.
- `ld ralph status <task_id>`: Monitor progress of a Ralph task.

## Configuration

Set the `LOCALDEV_BACKEND_URL` environment variable if your backend is running on a different port or host (default: `http://localhost:8000`).
