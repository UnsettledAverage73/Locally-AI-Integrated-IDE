SHELL := /bin/bash

.PHONY: all setup setup-frontend setup-backend setup-sidecar run run-sidecar build build-frontend build-backend build-vscodium-check build-vscodium-prepare clean

all: setup run

setup: setup-frontend setup-backend setup-sidecar
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

setup-sidecar:
	@echo "Setting up sidecar virtual environment and editable install..."
	@[ -d sidecar/.venv ] || python3 -m venv sidecar/.venv
	sidecar/.venv/bin/pip install -e ./sidecar

run:
	@echo "Starting LocalDev application in development mode..."
	npm start

run-sidecar:
	@echo "Starting LocalDev sidecar..."
	cd sidecar && . .venv/bin/activate && python -m localdev_sidecar.cli

build-frontend:
	@echo "Building frontend..."
	npm run build:frontend

build-backend:
	@echo "Building backend..."
	npm run build:backend

build:
	@echo "Performing full production build for LocalDev..."
	npm run build

build-vscodium-check:
	@echo "Checking LocalDev VSCodium build environment..."
	bash scripts/check-localdev-vscodium-env.sh

build-vscodium-prepare:
	@echo "Preparing LocalDev VSCodium source tree..."
	bash scripts/build-localdev-vscodium.sh --prepare-only

clean:
	@echo "Cleaning build artifacts and virtual environments..."
	rm -rf frontend/dist backend/build backend/dist release dist
	rm -rf node_modules frontend/node_modules
	rm -rf backend/venv
	@echo "Clean complete."
