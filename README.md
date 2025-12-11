# LocalDev - Privacy-First, Offline-Capable AI IDE

**Tagline:** The Privacy-First, Offline-Capable AI IDE.

## 🎯 Overview

LocalDev is an Integrated Development Environment (IDE) that runs Large Language Models (LLMs) entirely on your local machine. It indexes your codebase locally using a vector database to provide context-aware AI assistance without a single byte of data leaving your laptop.

## ✨ Features

- **🔒 Privacy-First**: Zero telemetry. No API calls to cloud services.
- **💻 Local AI**: Runs entirely on your machine using Ollama
- **🧠 RAG Pipeline**: Intelligent code indexing with LanceDB
- **💬 Chat Interface**: Context-aware AI assistant with **Markdown Rendering and Syntax Highlighting**
- **📝 Code Editor**: Monaco Editor with syntax highlighting
- **📁 File Explorer**: Navigate your project files
- **⚙️ Model Switcher**: Switch between different local LLM models
- **🖥️ Terminal**: Built-in terminal for running commands

## 🚀 Prerequisites

1. **Node.js** (v18 or higher)
2. **Ollama** - [Install Ollama](https://ollama.ai/)
3. **At least one LLM model** installed in Ollama:
   ```bash
   ollama pull deepseek-coder
   ollama pull nomic-embed-text  # For embeddings
   ```

## 📦 Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Local-AI-IDE
   ```

2. **Install Root Dependencies**: From the project root, run:
   ```bash
   npm install
   ```

3. **Install Frontend Dependencies**: Navigate to the `frontend` directory and run:
   ```bash
   cd frontend
   npm install
   ```

4. **Install Backend Dependencies**: Navigate to the `backend` directory, create and activate a Python virtual environment, then install dependencies:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

5. Start Ollama service (if not already running):
   ```bash
   ollama serve
   ```

## 🏃 Running the Application

### Development Mode

To run LocalDev in development mode:
1. **Start the FastAPI Backend**: This is now handled automatically when you run the Electron app in development mode.
2. **Start the React Frontend**: This is now handled automatically when you run the Electron app in development mode.
3. **Start the Electron App**: Open a terminal in the project root and run:
   ```bash
   npm start
   ```
   This will launch the Electron window, loading the React dev server URL (http://localhost:5173) and spawning the Python backend.

### Build for Production

```bash
npm run build
```

This creates distributable packages in the `release/` directory.

## 🛠️ Technology Stack

- **Framework**: Electron + React + TypeScript
- **Editor**: Monaco Editor (@monaco-editor/react)
- **AI Engine**: Ollama (local inference)
- **Database**: LanceDB (vector database for RAG)
- **Styling**: Tailwind CSS
- **Build Tool**: Vite

## 📋 Functional Requirements

| ID | Feature | Status |
|----|---------|--------|
| FR-01 | Editor Core | ✅ Complete |
| FR-02 | Local LLM Integration | ✅ Complete |
| FR-03 | RAG Pipeline (Memory) | ✅ Complete |
| FR-04 | Chat Interface | ✅ Complete |
| FR-05 | Model Switcher | ✅ Complete |
| FR-06 | Terminal Integration | ✅ Complete |

## 🎨 Usage

1. **Open a Project**: Click "Open Folder" to select your project directory
2. **Wait for Indexing**: The IDE will automatically index your codebase
3. **Ask Questions**: Use the chat panel to ask about your code
4. **Switch Models**: Go to Settings to change the AI model
5. **Edit Code**: Use the Monaco editor with full syntax highlighting

## 🔧 Configuration

### Changing AI Models

1. Open Settings (⚙️ icon in top bar)
2. Select your preferred model from the dropdown
3. Make sure the model is installed in Ollama:
   ```bash
   ollama pull <model-name>
   ```

### Recommended Models

- **For Coding**: `deepseek-coder`, `codellama`, `starcoder`
- **For Chat**: `llama3`, `mistral`, `phi`
- **For Embeddings**: `nomic-embed-text`

## 🏗️ Project Structure

```
Local-AI-IDE/
├── electron/          # Electron main process and renderer
│   └── main.js        # Main process entry
├── backend/           # FastAPI backend code
│   ├── main.py
│   └── services.py
├── frontend/          # React + Vite frontend code
│   ├── client/        # React client application
│   └── server/        # Node.js server for frontend assets (development)
├── dist/              # Frontend build output (after npm run build in frontend)
├── resources/         # Built backend executable and other resources
│   └── api/           # PyInstaller output
│       └── localdev-api  # Backend executable
├── build_backend.sh   # Script to build the Python backend
├── package.json       # Electron project configuration and scripts
├── README.md
```

## 🐛 Troubleshooting

### Ollama Connection Issues

If you see "Ollama backend is not reachable" or connection errors:
1. Make sure Ollama is installed and running: `ollama serve`
2. Make sure the LocalDev backend is running (it should start automatically with `npm run dev`).
3. Check the backend terminal for any errors related to Ollama or LanceDB.
4. Verify Ollama is accessible directly: `curl http://localhost:11434/api/tags`

### Model Not Found

If a model isn't available:
1. Install it via Ollama: `ollama pull <model-name>`
2. Refresh models in LocalDev's Settings.

### Indexing Issues

If code indexing fails:
1. Ensure Ollama's `nomic-embed-text` model is pulled: `ollama pull nomic-embed-text`
2. Check the backend terminal for RAG or LanceDB errors.
3. Verify the project folder is accessible by the backend process.

### Frontend Build Errors
- Run `npm install` in the project root to install all workspace dependencies.
- Then run `npm run build:frontend` to build the frontend specifically.

## 🔒 Privacy & Security

- **Zero Telemetry**: No data is sent to external servers
- **Local Processing**: All AI inference happens on your machine
- **No Cloud Calls**: No API calls to OpenAI, Anthropic, or any cloud service
- **Offline Capable**: Works completely offline after initial setup

## 📝 License

MIT License

## 👥 Team

- Lead Developer: Backend & AI Engine
- Frontend Specialist: UI/UX & Editor
- System & Testing: File System & DevOps

## 🗺️ Roadmap

- [ ] Multi-file editing with tabs
- [ ] Git integration
- [ ] Code completion (autocomplete)
- [ ] Debugger integration
- [ ] Plugin system
- [ ] Custom themes
- [ ] Performance optimizations

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ for developers who value privacy and offline capability.**

