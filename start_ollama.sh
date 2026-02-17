#!/bin/bash

# Determine Ollama command
OLLAMA_CMD="ollama"

if ! command -v ollama &> /dev/null; then
    if [ -f "ollama-linux-amd64.tgz" ] || [ -d "ollama-bundle" ]; then
        if [ ! -d "ollama-bundle" ]; then
             echo "Extracting ollama-linux-amd64.tgz..."
             mkdir -p ollama-bundle
             tar -xzf ollama-linux-amd64.tgz -C ollama-bundle
        fi
        OLLAMA_CMD="./ollama-bundle/bin/ollama"
    else
        echo "❌ Ollama not found globally and no bundle found."
        echo "Please install Ollama or ensure ollama-linux-amd64.tgz is in the project root."
        exit 1
    fi
fi

# Check if running
if ! curl -s http://127.0.0.1:11434/api/tags > /dev/null; then
    echo "⚠️ Ollama is not running. Starting..."
    $OLLAMA_CMD serve > ollama.log 2>&1 &
    
    # Wait for Ollama to start
    MAX_RETRIES=30
    COUNT=0
    while ! curl -s http://127.0.0.1:11434/api/tags > /dev/null; do
        sleep 1
        COUNT=$((COUNT+1))
        if [ $COUNT -ge $MAX_RETRIES ]; then
            echo "❌ Failed to start Ollama. Check ollama.log for details."
            exit 1
        fi
        echo -n "."
    done
    echo ""
fi

echo "✅ Ollama is ready."

# Function to pull model if missing
pull_model_if_missing() {
    MODEL=$1
    # Check via API to avoid parsing CLI output which might vary
    if ! curl -s http://127.0.0.1:11434/api/tags | grep -q "name":"$MODEL"; then
         # Try with :latest if not found? No, exact match logic or simple grep
         # Simple grep on JSON response: "name":"modelname"
         # But the model name in JSON might be "qwen2.5:0.5b:latest"
         
         # Fallback to CLI which is easier to read for humans but we are scripting.
         # Let's trust the CLI list
         if ! $OLLAMA_CMD list | grep -q "$MODEL"; then
            echo "⬇️ Pulling $MODEL..."
            $OLLAMA_CMD pull "$MODEL"
         else
            echo "✅ $MODEL is present."
         fi
    else
         echo "✅ $MODEL is present."
    fi
}

pull_model_if_missing "qwen2.5:0.5b"
pull_model_if_missing "nomic-embed-text"