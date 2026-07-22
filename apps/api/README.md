# Cortex API

Development API for turning the current CLI-oriented agent runner into a web product backend.

## Run

```bash
cd Cortex
source .venv/bin/activate
uvicorn apps.api.cortex_api.main:app --reload --port 8000
```

## Endpoints

- `GET /health`
- `GET /config/options`
- `GET /assets`
- `GET /assets/{symbol}/history`
- `POST /analyses`
- `GET /analyses`
- `GET /analyses/{id}`
- `GET /analyses/{id}/report`

The current runner now persists analyses and timeline events in a relational database. For local development it defaults to `sqlite:///./cortex_app.db`, and for production it can point to PostgreSQL with `DATABASE_URL` or `CORTEX_DATABASE_URL`.

Execution is still done by a single local worker thread. That is a good MVP step; the service boundary is already shaped so we can later swap the runner for Celery, Redis, and dedicated workers.
