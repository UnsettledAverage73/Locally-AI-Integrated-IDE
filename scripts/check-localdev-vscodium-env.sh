#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VSCODIUM_ROOT="${REPO_ROOT}/vscodium/src"

required_node="$(cat "${VSCODIUM_ROOT}/.nvmrc")"
actual_node="$(node --version | sed 's/^v//')"
actual_python="$(python3 --version | awk '{print $2}')"
actual_jq="$(jq --version | sed 's/^jq-//')"
actual_cargo="$(cargo --version | awk '{print $2}')"

echo "LocalDev VSCodium build preflight"
echo "repo: ${REPO_ROOT}"
echo "vscodium: ${VSCODIUM_ROOT}"
echo "required node: ${required_node}"
echo "actual node:   ${actual_node}"
echo "actual python: ${actual_python}"
echo "actual jq:     ${actual_jq}"
echo "actual cargo:  ${actual_cargo}"

failed=0

if [[ "${actual_node}" != "${required_node}" ]]; then
  echo "ERROR: node version mismatch. VSCodium expects ${required_node}."
  failed=1
fi

if [[ "${actual_python}" != 3.11.* ]]; then
  echo "ERROR: python3 version mismatch. VSCodium expects Python 3.11."
  failed=1
fi

if [[ ! -d "${VSCODIUM_ROOT}/vscode" ]]; then
  echo "ERROR: upstream vscode source tree is missing."
  failed=1
fi

if [[ ${failed} -ne 0 ]]; then
  exit 1
fi

echo "Preflight passed."
