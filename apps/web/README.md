# Cortex Web

Next.js frontend for the commercial product direction.

## Run

Node.js is required. The FastAPI backend should be running on port `8000`.

Backend:

```bash
cd Cortex
source .venv-cortex/bin/activate  # or your project virtualenv
uvicorn apps.api.cortex_api.main:app --reload --port 8000
```

Frontend:

```bash
cd Cortex/apps/web
npm install
npm run dev
```

The app expects the API at `http://localhost:8000`. Override it with:

```bash
NEXT_PUBLIC_CORTEX_API_URL=http://localhost:8000 npm run dev
```

## Oportunidades

The dashboard includes an `Oportunidades` tab for Day Trade and Swing Trade
technical signals. Fill in the asset, strategy type, timeframe, risk profile,
capital, max risk, provider and max signal count, then click `Analisar
oportunidade`.

The screen shows direction, confidence, setup, entry, stop, take profit,
risk/reward, position size, max loss, invalidation criteria and warnings. When
entry/stop/take-profit are available, the market chart can display those levels.

Signals are educational analysis only, not financial advice. The MT5 option is
a safe stub and does not execute real orders.
