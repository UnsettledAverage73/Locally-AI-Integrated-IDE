SHELL := /bin/bash

.PHONY: all setup setup-frontend setup-backend run build build-frontend build-backend clean

all: setup run

setup: setup-frontend setup-backend
	@echo "All setup complete."

setup-frontend:
	@echo "Setting up root Node.js dependencies..."
	npm install
	@echo "Setting up frontend Node.js dependencies..."
	cd frontend && npm install

setup-backend:
	@echo "Setting up backend Python virtual environment and dependencies..."
	# Create venv if it doesn't exist
	@mkdir -p backend
	@[ -d backend/venv ] || python3 -m venv backend/venv
	# Activate venv and install requirements
	backend/venv/bin/pip install -r backend/requirements.txt

run:
	@echo "Starting LocalDev application in development mode..."
	npm start

build-frontend:
	@echo "Building frontend..."
	npm run build:frontend

build-backend:
	@echo "Building backend..."
	npm run build:backend

build:
	@echo "Performing full production build for LocalDev..."
	npm run build

clean:
	@echo "Cleaning build artifacts and virtual environments..."
	rm -rf frontend/dist backend/build backend/dist release dist
	rm -rf node_modules frontend/node_modules
	rm -rf backend/venv
	@echo "Clean complete."