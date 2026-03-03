import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { SettingsProvider } from "./context/SettingsContext";

// Global error listener for debugging
window.addEventListener('error', (event) => {
    console.error('Global Error caught:', event.error);
    const root = document.getElementById('root');
    if (root && root.innerHTML === "") {
        root.innerHTML = `<div style="padding: 20px; color: white; background: #1e1e1e; height: 100vh; font-family: monospace;">
            <h1 style="color: #ff5555;">Startup Error Caught</h1>
            <pre>${event.error?.stack || event.message}</pre>
        </div>`;
    }
});

createRoot(document.getElementById("root")!).render(
    <SettingsProvider>
        <App />
    </SettingsProvider>
);
