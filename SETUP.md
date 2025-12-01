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
   npm run electron:dev
   ```

## Development Workflow

### First Time Setup
1. Install Node.js (v18+)
2. Install Ollama
3. Run `npm install`
4. Pull required models
5. Start Ollama service

### Daily Development
1. Start Ollama: `ollama serve`
2. In another terminal: `npm run electron:dev`
3. Open a project folder in LocalDev
4. Wait for code indexing to complete
5. Start coding with AI assistance!

## Troubleshooting

### "Ollama backend is not reachable"
- Make sure Ollama service is running: `ollama serve`
- Ensure the LocalDev backend is running (it should start automatically with `npm run dev`).
- Check the backend terminal for any errors related to Ollama or LanceDB.
- Verify Ollama is accessible directly: `curl http://localhost:11434/api/tags`

### "Model not found"
- Install the model via Ollama: `ollama pull <model-name>`
- Refresh models in LocalDev's Settings.

### Indexing Issues
- Ensure Ollama's `nomic-embed-text` model is pulled: `ollama pull nomic-embed-text`
- Check the backend terminal for RAG or LanceDB errors.
- Verify the project folder is accessible by the backend process.

### Frontend Build Errors
- Run `npm install` in the project root to install all workspace dependencies.
- Then run `npm run build:frontend` to build the frontend specifically.

### TypeScript Errors
- Run `npm install` to ensure all type definitions are installed for the frontend.
- Some errors may be false positives until dependencies are installed.

## Project Structure

```
Local-AI-IDE/
├── frontend/          # Electron + React frontend
│   ├── electron/      # Electron main process & preload
│   ├── src/           # React source code
│   ├── package.json   # Frontend dependencies & scripts
│   └── ...            # Other frontend config (vite, tailwind, tsconfig)
├── backend/           # FastAPI backend
│   ├── main.py        # FastAPI application
│   ├── services.py    # Ollama & LanceDB RAG services
│   ├── requirements.txt # Python dependencies
│   └── package.json   # Backend workspace scripts
├── package.json       # Root workspace package.json
├── PROJECT_SUMMARY.md # Project summary and status
├── README.md          # Main documentation
└── SETUP.md           # Detailed setup instructions
```

## Next Steps

After setup, you can:
- Open any code project
- Ask the AI about your code
- Get code explanations and fixes
- All processing happens locally!

