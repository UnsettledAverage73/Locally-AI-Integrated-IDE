# LocalDev - Project Context for Gemini

## 🎯 Project Overview

**LocalDev** is a privacy-first, offline-capable Integrated Development Environment (IDE) that integrates Large Language Models (LLMs) directly into the workflow without sending data to the cloud.

### Architecture
The application follows a multi-process architecture:
1.  **Electron (Root)**: The main desktop application container (`electron/main.js`). It manages the window and spawns the Python backend.
2.  **Frontend (React)**: The UI layer (`frontend/`), built with Vite, React, TypeScript, and Tailwind CSS. It uses Monaco Editor for code editing.
3.  **Backend (Python)**: A FastAPI service (`backend/`) that handles AI inference via Ollama and RAG (Retrieval-Augmented Generation) with LanceDB.
4.  **Motia App**: A separate component (`motia-app/`) included in the repository, representing a project using the Motia framework (likely an example or target environment).

## 🛠️ Building and Running

### Prerequisites
- **Node.js**: v18 or higher.
- **Python**: v3.8 or higher.
- **Ollama**: Installed and running (`ollama serve`).
- **Models**: Pull required models:
    ```bash
    ollama pull deepseek-coder
    ollama pull nomic-embed-text
    ```

### Installation
1.  **Root Dependencies**:
    ```bash
    npm install
    ```
2.  **Frontend Dependencies**:
    ```bash
    cd frontend
    npm install
    ```
3.  **Backend Dependencies**:
    ```bash
    cd backend
    python -m venv venv
    source venv/bin/activate  # Windows: venv\Scripts\activate
    pip install -r requirements.txt
    ```

### Running in Development
To start the application (Electron + Frontend + Backend):

```bash
# From the project root
npm start
```
*This command starts the Electron process, which in turn launches the React dev server and spawns the Python backend.*

### Building for Production
To create distributable installers (Windows/macOS/Linux):

```bash
npm run build
```
*This runs `build:frontend`, `build:backend` (via `build_backend.sh`), and then `electron-builder`.*

## 📂 Key Directories

-   **`electron/`**: Main process code for the desktop app.
-   **`frontend/`**:
    -   `src/components/`: React UI components (Editor, ChatPanel, FileExplorer).
    -   `src/lib/`: Utilities and API clients.
    -   `server/`: Node.js server (BFF) used during development.
-   **`backend/`**:
    -   `main.py`: FastAPI entry point.
    -   `services.py`: Core logic for Ollama interaction and RAG.
-   **`motia-app/`**: A Motia framework tutorial project.
-   **`dist/`**: Output directory for frontend builds.
-   **`release/`**: Output directory for final Electron installers.

## 📝 Development Conventions

-   **Tech Stack**: React (UI), Tailwind (CSS), Monaco (Editor), FastAPI (AI Service).
-   **Styling**: Uses `shadcn/ui` components located in `frontend/src/components/ui`.
-   **State Management**: React Query (`@tanstack/react-query`) is used for data fetching in the frontend.
-   **Type Safety**: TypeScript is strictly used in Frontend and Electron. Python uses type hints where possible.
-   **Formatting**: Standard Prettier/ESLint configurations likely apply (inferred from `package.json`).

## ⚠️ Common Issues & Troubleshooting

-   **Ollama Connection**: Ensure `ollama serve` is running before starting the app.
-   **Model Errors**: If the chat fails, verify you have pulled `deepseek-coder` and `nomic-embed-text`.
-   **Backend Startup**: If the backend fails to spawn, check `backend/requirements.txt` installation and virtual environment activation.
