#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$ROOT_DIR/.tools/ollama-home" "$ROOT_DIR/.tools/ollama-models"

export HOME="$ROOT_DIR/.tools/ollama-home"
export OLLAMA_MODELS="$ROOT_DIR/.tools/ollama-models"
export OLLAMA_HOST="127.0.0.1:11434"

exec "$ROOT_DIR/.tools/ollama/bin/ollama" serve
