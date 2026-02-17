#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Helper Functions ---
print_info() {
    echo -e "\e[34m[INFO]\e[0m $1"
}

print_success() {
    echo -e "\e[32m[SUCCESS]\e[0m $1"
}

print_warning() {
    echo -e "\e[33m[WARNING]\e[0m $1"
}

print_error() {
    echo -e "\e[31m[ERROR]\e[0m $1" >&2
}

# --- Check for root privileges ---
if [ "$EUID" -ne 0 ]; then
  print_warning "This script requires root privileges for installing packages."
  sudo -v
  if [ $? -ne 0 ]; then
    print_error "Sudo privileges are required. Exiting."
    exit 1
  fi
fi

# --- Update Package Manager ---
print_info "Updating package manager..."
sudo apt-get update

# --- Install Docker ---
if ! command -v docker &> /dev/null; then
    print_info "Docker not found. Installing Docker..."
    sudo apt-get install -y apt-transport-https ca-certificates curl software-properties-common
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
    sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"
    sudo apt-get update
    sudo apt-get install -y docker-ce
    print_success "Docker installed successfully."
else
    print_info "Docker is already installed."
fi

# --- Start and enable Docker service ---
print_info "Starting and enabling Docker service..."
sudo systemctl start docker
sudo systemctl enable docker

# --- Install Ollama ---
if ! command -v ollama &> /dev/null; then
    print_info "Ollama not found. Installing Ollama..."
    curl -fsSL https://ollama.ai/install.sh | sh
    print_success "Ollama installed successfully."
else
    print_info "Ollama is already installed."
fi

# --- Start Ollama Service ---
print_info "Starting Ollama service..."
sudo systemctl start ollama

# --- Pull Ollama Models ---
print_info "Pulling required Ollama models..."
ollama pull qwen2.5:0.5b
ollama pull nomic-embed-text:latest

print_success "Ollama models pulled successfully."

print_success "Private cloud setup complete!"
print_info "You can now connect to this machine from your LocalDev IDE."
