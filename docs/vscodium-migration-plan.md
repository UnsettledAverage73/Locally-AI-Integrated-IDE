# VSCodium Migration Plan

## Goal

Replace the custom Electron + React IDE shell with a VSCodium-based product and keep the local AI system as a standalone sidecar process.

The editor should become a thin host for:

- AI chat and agent workflows
- codebase indexing and retrieval
- model management
- git-aware reasoning
- patch generation and apply flows

## Product Shape

### What We Keep

- local inference through Ollama
- local retrieval and memory
- multi-step agent orchestration
- terminal and git reasoning
- local-first privacy posture

### What We Stop Building

- custom file explorer
- custom editor shell
- custom tab system
- custom terminal UI
- custom source control UI

## New Repository Direction

```text
.
├── backend/                # legacy API app to mine for logic during migration
├── docs/
│   ├── bridge-protocol.md
│   └── vscodium-migration-plan.md
├── sidecar/                # new standalone AI runtime for the IDE
│   ├── pyproject.toml
│   ├── README.md
│   └── src/localdev_sidecar/
│       ├── __init__.py
│       ├── cli.py
│       ├── protocol.py
│       └── server.py
└── vscodium/               # reserved for fork checkout and workbench integration
```

## Migration Phases

### Phase 1

Ship a standalone sidecar with a stable editor bridge over stdio.

### Phase 2

Fork VSCodium into `vscodium/` and add:

- sidecar process lifecycle
- native AI panel
- inline edit and diff apply actions
- settings for model/runtime control

### Phase 3

Move proven logic from `backend/` into sidecar modules and stop expanding the custom frontend.

## Immediate Engineering Priorities

1. Define a versioned bridge protocol.
2. Make the sidecar bootable as an independent process.
3. Keep the sidecar transport editor-agnostic.
4. Treat the current FastAPI app as a donor codebase, not the final architecture.

## Rules For The VSCodium Fork

1. Keep the fork shallow until the sidecar protocol stabilizes.
2. Prefer workbench integration over deep editor rewrites.
3. Keep AI state in the sidecar, not in editor memory.
4. Preserve VS Code extension compatibility wherever possible.
5. Do not let frontend chrome work compete with agent quality work.
