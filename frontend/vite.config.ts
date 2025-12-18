import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

// CHANGE: Use an async function to safely allow 'await' for plugins
export default defineConfig(async () => {
  return {
    // --------------------------------------------------------
    // CRITICAL FIX FOR ELECTRON WHITE SCREEN
    // --------------------------------------------------------
    base: "./", 
    // --------------------------------------------------------

    plugins: [
      react(),
      runtimeErrorOverlay(),
      tailwindcss(),
      metaImagesPlugin(),
      // Only load Replit plugins if we are actually on Replit
      ...(process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer()
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner()
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
        "@shared": path.resolve(import.meta.dirname, "shared"),
        "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      },
    },
    css: {
      postcss: {
        plugins: [],
      },
    },
    root: path.resolve(import.meta.dirname, "client"),
    build: {
      // NOTE: This builds to "dist/public". 
      // Ensure your main.js loads path.join(__dirname, 'dist', 'public', 'index.html')
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
  };
});
