# Sidecar Bridge Protocol

## Transport

The first transport is newline-delimited JSON over stdio.

Each request and response is a single JSON object on one line.

## Envelope

### Request

```json
{
  "id": "req_123",
  "method": "health",
  "params": {}
}
```

### Response

```json
{
  "id": "req_123",
  "ok": true,
  "result": {
    "status": "ok"
  }
}
```

### Error

```json
{
  "id": "req_123",
  "ok": false,
  "error": {
    "code": "unknown_method",
    "message": "Unknown method: nope"
  }
}
```

## Core Methods

### Lifecycle

- `initialize`
- `health`
- `shutdown`

### Model Runtime

- `models.list`
- `models.select`
- `models.pull`

### Workspace

- `workspace.open`
- `workspace.index.request`
- `workspace.index.status`
- `workspace.search`

### Editing

- `edit.propose`
- `edit.apply`
- `diff.preview`

### Chat And Agent

- `chat.stream.start`
- `chat.cancel`
- `agent.run`
- `agent.approve`

### Memory

- `memory.store`
- `memory.search`

## Events

Events are sent as best-effort unsolicited messages:

```json
{
  "event": "workspace.index.progress",
  "payload": {
    "done": 12,
    "total": 90
  }
}
```

Initial event families:

- `log`
- `workspace.index.progress`
- `chat.delta`
- `agent.status`

## Versioning

- protocol version is negotiated during `initialize`
- breaking changes require a new major protocol version
- editor and sidecar must fail fast on version mismatch
