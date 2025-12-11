# LocalDev Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Install Ollama**
   - Download from: https://ollama.ai/
   - Or use package manager:
     ```bash
     # Windows (using winget)
     winget install Ollama.Ollama
     
     # Linux
     curl -fsSL https://ollama.ai/install.sh | sh
     ```

3. **Download AI Models**
   ```bash
   # For coding assistance
   ollama pull deepseek-coder
   
   # For embeddings (required for RAG)
   ollama pull nomic-embed-text
   
   # Optional: Other models
   ollama pull llama3
   ollama pull codellama
   ```

4. **Start Ollama Service**
   ```bash
   ollama serve
   ```
   Keep this running in a terminal.

5. **Run LocalDev**
   ```bash
   # In a new terminal, from the project root
   npm start
   ```
   This will launch the Electron development server and the backend.

## Development Workflow

### First Time Setup
1. Install Node.js (v18+)
2. Install Ollama
3. From the project root, run: `npm install`
4. From the `frontend` directory, run: `npm install` (for React dependencies, including markdown rendering)
5. From the `backend` directory, create and activate a Python virtual environment, then install dependencies: `python -m venv venv && source venv/bin/activate && pip install -r requirements.txt`
6. Pull required AI models (e.g., `ollama pull deepseek-coder`, `ollama pull nomic-embed-text`).
7. Start Ollama service: `ollama serve`

### Daily Development
1. Start Ollama: `ollama serve` (if not already running)
2. In another terminal, from the project root: `npm start`
3. Open a project folder in LocalDev.
4. Wait for code indexing to complete.
5. Start coding with AI assistance!

### Build for Production
1. From the project root, run: `npm run build`
2. This will create distributable packages in the `release/` directory.

## Troubleshooting

### "Ollama backend is not reachable"
- Make sure Ollama service is running: `ollama serve`
- Ensure the LocalDev backend is running (it should start automatically with `npm start` in dev mode).
- Check the terminal where you ran `npm start` for any errors related to Ollama or LanceDB.
- Verify Ollama is accessible directly: `curl http://localhost:11434/api/tags`

### "Model not found"
- Install the model via Ollama: `ollama pull <model-name>`
- Refresh models in LocalDev's Settings.

### Indexing Issues
- Ensure Ollama's `nomic-embed-text` model is pulled: `ollama pull nomic-embed-text`
- Check the terminal where you ran `npm start` for RAG or LanceDB errors.
- Verify the project folder is accessible by the backend process.

### Frontend Build Errors
- Run `npm install` in the project root to install all workspace dependencies, then `cd frontend && npm install` for frontend-specific dependencies.
- Then run `npm run build:frontend` from the project root to build the frontend specifically.

### TypeScript Errors
- Run `npm install` in the project root and `cd frontend && npm install` to ensure all type definitions are installed.
- Some errors may be false positives until dependencies are installed.

## Project Structure

```
Local-AI-IDE/
├── .git/              # Git version control
├── backend/           # FastAPI backend code
│   ├── main.py        # FastAPI application
│   ├── services.py    # Ollama & LanceDB RAG services
│   ├── requirements.txt # Python dependencies
│   └── venv/          # Python virtual environment
├── build_backend.sh   # Script to build the Python backend with PyInstaller
├── build-resources/   # Icons for Electron Builder
│   ├── icon.ico
│   ├── icon.icns
│   └── icon.png
├── dist/              # Frontend build output (React + Vite)
│   ├── public/
│   ├── electron/      # Copied Electron main process for packaging
│   │   └── main.js
│   └── package.json   # Minimal package.json for Electron Builder
├── electron/          # Electron main process source
│   └── main.js        # Main process entry
├── frontend/          # React + Vite frontend source code and build scripts
│   ├── client/        # React client application source
│   ├── server/        # Node.js server for frontend assets (development)
│   ├── package.json   # Frontend dependencies & scripts
│   └── ...            # Other frontend config (vite, tailwind, tsconfig)
├── node_modules/      # Node.js dependencies for the root Electron project
├── package.json       # Root Electron project configuration and scripts
├── package-lock.json
├── release/           # Output directory for Electron Builder (installers)
├── resources/         # Built backend executable and other resources
│   └── api/           # PyInstaller output
│       └── localdev-api  # Backend executable
├── PROJECT_SUMMARY.md # Project summary and status
├── README.md          # Main documentation
└── SETUP.md           # Detailed setup instructions
```

## Next Steps

After setup, you can:
- Open any code project
- Ask the AI about your code, which now supports **Markdown rendering with syntax highlighting**.
- Get code explanations and fixes
- All processing happens locally!

