#!/usr/bin/env bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VSCODIUM_ROOT="${REPO_ROOT}/vscodium/src"

prepare_only="no"
check_only="no"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prepare-only)
      prepare_only="yes"
      shift
      ;;
    --check)
      check_only="yes"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

"${REPO_ROOT}/scripts/check-localdev-vscodium-env.sh"

if [[ "${check_only}" == "yes" ]]; then
  exit 0
fi

export APP_NAME="LocalDev"
export APP_NAME_LC="localdev"
export ASSETS_REPOSITORY="unsettledaverage73/localdev"
export BINARY_NAME="localdev"
export CI_BUILD="no"
export DISABLE_UPDATE="yes"
export GLOBAL_DIRNAME="LocalDev"
export GH_REPO_PATH="unsettledaverage73/localdev"
export ORG_NAME="LocalDev"
export SHOULD_BUILD="yes"
export SHOULD_BUILD_REH="no"
export SHOULD_BUILD_REH_WEB="no"
export TUNNEL_APP_NAME="localdev-tunnel"
export BUILD_SOURCEVERSION="${BUILD_SOURCEVERSION:-}"
export GITHUB_ENV="${GITHUB_ENV:-}"
export VSCODE_LATEST="no"
export VSCODE_QUALITY="stable"
export VSCODE_ARCH="${VSCODE_ARCH:-x64}"
export npm_config_arch="${npm_config_arch:-${VSCODE_ARCH}}"
export VSCODE_SKIP_NODE_VERSION_CHECK="no"

case "${OSTYPE}" in
  darwin*)
    export OS_NAME="osx"
    ;;
  msys* | cygwin*)
    export OS_NAME="windows"
    ;;
  *)
    export OS_NAME="linux"
    ;;
esac

cd "${VSCODIUM_ROOT}"

if [[ "${prepare_only}" == "yes" ]]; then
  export MS_TAG="$(jq -r '.tag' "./upstream/${VSCODE_QUALITY}.json")"
  export MS_COMMIT="$(jq -r '.commit' "./upstream/${VSCODE_QUALITY}.json")"
  export RELEASE_VERSION="${MS_TAG}0000"
  . version.sh
  git -C vscode reset --hard
  git -C vscode clean -fd
  git -C vscode fetch --depth 1 origin "${MS_COMMIT}"
  git -C vscode checkout -f FETCH_HEAD
  . prepare_vscode.sh
else
  . build.sh
fi
