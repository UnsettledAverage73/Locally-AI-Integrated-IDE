# LocalDev - Privacy-First, Offline-Capable AI IDE

**Tagline:** The Privacy-First, Offline-Capable AI IDE.

## 🎯 Overview

LocalDev is an Integrated Development Environment (IDE) that runs Large Language Models (LLMs) entirely on your local machine. It indexes your codebase locally using a vector database to provide context-aware AI assistance without a single byte of data leaving your laptop.

## ✨ Features

- **🔒 Privacy-First**: Zero telemetry. No API calls to cloud services.
- **💻 Local AI**: Runs entirely on your machine using Ollama
- **🧠 RAG Pipeline**: Intelligent code indexing with LanceDB
- **💬 Chat Interface**: Context-aware AI assistant
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

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start Ollama service (if not already running):
   ```bash
   ollama serve
   ```

## 🏃 Running the Application

### Development Mode

```bash
npm run electron:dev
```

This will:
- Start the Vite dev server
- Launch Electron with hot reload

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
├── electron/          # Electron main process
│   ├── main.ts        # Main process entry
│   └── preload.ts     # Preload script
├── src/
│   ├── components/    # React components
│   │   ├── Editor.tsx
│   │   ├── ChatPanel.tsx
│   │   ├── FileExplorer.tsx
│   │   ├── Terminal.tsx
│   │   └── Settings.tsx
│   ├── services/      # Business logic
│   │   ├── ollama.ts  # Ollama integration
│   │   └── rag.ts     # RAG pipeline
│   ├── App.tsx        # Main app component
│   └── main.tsx       # React entry point
└── package.json
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

