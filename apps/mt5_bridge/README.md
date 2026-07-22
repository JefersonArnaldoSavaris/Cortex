# Cortex MT5 Bridge

Serviço FastAPI para rodar dentro da VM Windows com o terminal MetaTrader 5.
Ele expõe dados de mercado para o backend Cortex Linux via HTTP local.

## Instalação na VM Windows

1. Instale o MetaTrader 5 da corretora.
2. Instale Python 3.12 ou compatível.
3. Copie/clona este projeto `Cortex` dentro da VM.
4. No PowerShell, dentro da pasta do projeto:

```powershell
python -m venv .venv-mt5-bridge
.\.venv-mt5-bridge\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install fastapi uvicorn MetaTrader5 pydantic requests
```

5. Inicie a bridge:

```powershell
python -m uvicorn apps.mt5_bridge.main:app --host 0.0.0.0 --port 8765
```

## Comunicação com o Cortex Linux

A VM foi preparada com NAT port-forward:

```text
Host Linux 127.0.0.1:8765 -> Windows VM 8765
```

No backend Cortex Linux, configure:

```bash
CORTEX_MT5_BRIDGE_URL=http://127.0.0.1:8765
```

Depois reinicie a API Cortex.

## Endpoints

- `GET /health`
- `POST /connect`
- `POST /disconnect`
- `GET /status`
- `GET /ohlcv?symbol=WIN$N&timeframe=M15&limit=160`
- `GET /price?symbol=WIN$N`
- `GET /symbols?query=EUR&limit=500`

O serviço é somente leitura. Não há endpoint de ordem.
