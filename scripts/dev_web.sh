#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT_DIR/.tools/node-v24.15.0-linux-x64/bin:$PATH"

cd "$ROOT_DIR/apps/web"
npm run dev

