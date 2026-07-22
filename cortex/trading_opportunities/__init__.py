"""Short-term trading opportunity analysis for Cortex.

This package generates educational, technical-analysis signals for day trade
and swing trade workflows. It does not execute real orders.
"""

from .opportunity_agent import TradingOpportunityAgent
from .schemas import OpportunityRequest, OpportunitySignal

__all__ = ["OpportunityRequest", "OpportunitySignal", "TradingOpportunityAgent"]
