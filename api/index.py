"""Vercel Python runtime entrypoint for the Cortex FastAPI application."""

from apps.api.cortex_api.main import app

__all__ = ["app"]
