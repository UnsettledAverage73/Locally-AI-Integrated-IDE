# LocalDev Sidecar

The sidecar is the future runtime of the product.

It is responsible for:

- editor bridge protocol
- local model orchestration
- workspace indexing
- retrieval and memory
- agent execution
- patch generation

The current implementation is intentionally small. It provides a bootable stdio server so the VSCodium fork can integrate against a stable process boundary first.

## Local Run

```bash
cd sidecar
python -m localdev_sidecar.cli
```

## Test Manually

```json
{"id":"1","method":"initialize","params":{"client":"dev-shell","protocol_version":"0.1.0"}}
{"id":"2","method":"health","params":{}}
{"id":"3","method":"models.list","params":{}}
{"id":"4","method":"chat.ask","params":{"prompt":"Summarize this workspace"}}
{"id":"5","method":"shutdown","params":{}}
```
