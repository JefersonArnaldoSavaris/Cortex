# Cortex Product Apps

This folder starts the commercial product layer around the existing Cortex engine.

## Current MVP

- `api/`: FastAPI backend that exposes analysis jobs over HTTP.
- `web/`: Next.js frontend for creating analyses, reading reports, and analyzing short-term opportunities.

## Development Flow

Terminal 1:

```bash
cd Cortex
source .venv-cortex/bin/activate  # or your project virtualenv
uvicorn apps.api.cortex_api.main:app --reload --port 8000
```

Terminal 2:

```bash
cd Cortex/apps/web
npm install
npm run dev
```

Open `http://localhost:3000`.

## Trading Opportunities

The API exposes a read-only short-term signal endpoint:

```bash
curl -X POST http://localhost:8000/opportunities/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "SPY",
    "strategy_type": "daytrade",
    "timeframe": "M15",
    "risk_profile": "moderado",
    "capital": 10000,
    "max_risk_per_trade": 0.01,
    "max_signals": 1,
    "provider": "mock",
    "limit": 160
  }'
```

In the web app, open the `Oportunidades` tab, fill the form, and run
`Analisar oportunidade`. Results are educational technical signals only. The
MT5 provider remains a non-executing safety stub and no real orders are placed.

## Persistence

The API now persists analyses and timeline events in a relational database.

- Local development default: `sqlite:///./cortex_app.db`
- Production target: PostgreSQL via `DATABASE_URL` or `CORTEX_DATABASE_URL`

Reports continue to be written to `reports/`, and the final markdown is also stored in the database for easier product retrieval.

## Production Direction

This is now a better SaaS foundation, but we still need the next product layers before commercial launch:

- PostgreSQL as the primary production database.
- Celery workers for long-running Cortex executions.
- Redis or RabbitMQ as the task broker.
- Object storage for large report artifacts.
- Auth, billing, per-user provider keys, and usage limits.
