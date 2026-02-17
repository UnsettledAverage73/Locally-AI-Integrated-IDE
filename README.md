# 🚀 Average - The Privacy-First AI IDE 🔒

![LocalDev Screenshot](images/Screenshot%20from%202026-01-12%2019-36-20.png)

## 🌟 Overview

**Average IDE** is a revolutionary **offline-capable** and **privacy-first** Integrated Development Environment (IDE). It brings the power of Large Language Models (LLMs) directly to your local machine, ensuring that **not a single byte of your code leaves your computer**.

Built for developers who value security, speed, and autonomy, LocalDev indexes your project locally using a vector database to provide context-aware AI assistance—completely offline.

> *"A good writer possesses not only his own spirit but also the spirit of his friends."* — Friedrich Nietzsche

---

## ✨ Key Features

- **🔒 Privacy-First:** Zero telemetry. No cloud API calls. Your code stays yours.
- **🧠 Local RAG Pipeline:** Intelligent code indexing with LanceDB for context-aware answers.
- **💬 AI Chat Interface:** Integrated chat with Markdown rendering and syntax highlighting.
- **⚡ Offline-Capable:** Runs entirely on your machine using **Ollama**.
- **📝 Monaco Editor:** Professional-grade code editing experience.
- **🔄 Batch Scaffolding:** Generate entire project structures with the "Architect" persona.
- **🛠️ MCP Integration:** Extensible tool execution via Model Context Protocol.

---

## 🚀 Getting Started

Follow these steps to set up your environment.

### 📋 Prerequisites

Ensure you have the following installed:
1.  **Node.js** (v18 or higher)
2.  **Python** (v3.8 or higher)
3.  **Ollama** (for running local LLMs)

### 🐳 Docker Setup for Ollama (Recommended)

If you prefer using Docker to run Ollama, use the following command:

```bash
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

### 📥 Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/UnsettledAverage73/Locally-AI-Integrated-IDE.git
    cd Locally-AI-Integrated-IDE
    ```

2.  **Install Root Dependencies**
    ```bash
    npm install
    ```

3.  **Install Frontend Dependencies**
    ```bash
    cd frontend
    npm install
    ```

4.  **Install Backend Dependencies**
    ```bash
    cd ../backend
    python -m venv venv
    source venv/bin/activate  # On Windows use: venv\Scripts\activate
    pip install -r requirements.txt
    ```

5.  **Pull Required Models**
    Ensure Ollama is running (`ollama serve` or via Docker), then pull the models:
    ```bash
    ollama pull qwen2.5:0.5b
    ollama pull nomic-embed-text
    ```

---

## 🏃 Usage

### Running in Development

To start the application (Electron + Frontend + Backend) in one go:

```bash
# From the project root
npm start
```

This will launch the desktop application window.

### ⚙️ Configuration

-   **Change Models:** Click the ⚙️ Settings icon to switch between installed Ollama models.
-   **Keybindings:** Standard VS Code-like keybindings are supported.

---

## 🚧 Project Status: In Progress

We are actively developing LocalDev! Here's what's new and what's coming:

### ✅ Implemented
-   [x] Core Editor with Syntax Highlighting
-   [x] Local RAG (Retrieval-Augmented Generation)
-   [x] Chat Interface with History
-   [x] Model Switching Mechanism
-   [x] "Architect" Persona for Scaffolding

### 🔜 Roadmap
-   [ ] Git Integration (Commits, Diffs)
-   [ ] Multi-tab Editing
-   [ ] Plugin System
-   [ ] Integrated Debugger

---

## 🧪 Tests

To ensure everything is working correctly, you can run the test suite:

```bash
# Run backend tests
cd backend
python -m pytest
```

---

## 🤝 Contributing

We welcome contributions! If you'd like to help improve LocalDev:

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

Please read our [CONTRIBUTING.md](CONTRIBUTING.md) (coming soon) for details on our code of conduct.

---

## 👤 Author & Credits

**Made by:** [@unsettledaverage73](https://github.com/unsettledaverage73)

-   **Author:** [@unsettledaverage73](https://github.com/unsettledaverage73)
-   **Support & FAQ:** [atharvabodade@gmail.com](mailto:atharvabodade@gmail.com)
-   **LinkedIn:** [https://www.linkedin.com/in/unsettledaverage73/](https://www.linkedin.com/in/unsettledaverage73/)

### Acknowledgements
Special thanks to the open-source community, specifically the teams behind **Ollama**, **Electron**, and **React**.

---

### *All Average is not Average*

*Do share your valuable opinion, I appreciate your honest feedback!*

**Enjoy Coding ❤**