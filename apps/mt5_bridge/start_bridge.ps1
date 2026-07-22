$ErrorActionPreference = "Stop"

Set-Location (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)))

if (-not (Test-Path ".venv-mt5-bridge")) {
    python -m venv .venv-mt5-bridge
}

.\.venv-mt5-bridge\Scripts\python.exe -m pip install --upgrade pip
.\.venv-mt5-bridge\Scripts\python.exe -m pip install fastapi "uvicorn[standard]" MetaTrader5 requests
.\.venv-mt5-bridge\Scripts\python.exe -m uvicorn apps.mt5_bridge.main:app --host 0.0.0.0 --port 8765

