#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
source .venv/bin/activate
uvicorn apps.api.cortex_api.main:app --reload --port 8000

