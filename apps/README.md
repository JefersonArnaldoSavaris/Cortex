# TradingAgents Product Apps

This folder starts the commercial product layer around the existing TradingAgents engine.

## Current MVP

- `api/`: FastAPI backend that exposes analysis jobs over HTTP.
- `web/`: Next.js frontend for creating analyses and reading reports.

## Development Flow

Terminal 1:

```bash
cd "/home/jefe/dev/Tauric Research/TradingAgents"
source .venv/bin/activate
uvicorn apps.api.tradingagents_api.main:app --reload --port 8000
```

Terminal 2:

```bash
cd "/home/jefe/dev/Tauric Research/TradingAgents/apps/web"
npm install
npm run dev
```

Open `http://localhost:3000`.

## Persistence

The API now persists analyses and timeline events in a relational database.

- Local development default: `sqlite:///./tradingagents_app.db`
- Production target: PostgreSQL via `DATABASE_URL` or `TRADINGAGENTS_DATABASE_URL`

Reports continue to be written to `reports/`, and the final markdown is also stored in the database for easier product retrieval.

## Production Direction

This is now a better SaaS foundation, but we still need the next product layers before commercial launch:

- PostgreSQL as the primary production database.
- Celery workers for long-running TradingAgents executions.
- Redis or RabbitMQ as the task broker.
- Object storage for large report artifacts.
- Auth, billing, per-user provider keys, and usage limits.
