# LocalDev Build Notes

## Toolchain

This repo now pins the VSCodium build toolchain in [.mise.toml](/home/unsettledaverage73/Locally-AI-Integrated-IDE/.mise.toml):

- Node `22.22.0`
- Python `3.11`

If `mise` is installed:

```bash
mise install
mise exec -- bash scripts/check-localdev-vscodium-env.sh
mise exec -- bash scripts/build-localdev-vscodium.sh --prepare-only
```

## Why

The upstream VSCodium build is strict about tool versions. The system versions in this workspace are newer than supported, which is enough to make the build path unreliable.
