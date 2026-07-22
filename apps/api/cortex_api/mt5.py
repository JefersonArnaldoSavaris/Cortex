from __future__ import annotations

from dataclasses import dataclass
import os
from threading import RLock

from dotenv import load_dotenv

from cortex.trading_opportunities.providers import MarketDataProvider, MT5BridgeMarketDataProvider, MT5Credentials, MT5MarketDataProvider

from .models import AuthUser, MT5ConnectRequest, MT5StatusResponse


@dataclass
class _MT5Session:
    credentials: MT5Credentials | None
    account: dict[str, str | int | float | bool | None]
    bridge_url: str | None = None


class MT5SessionManager:
    """In-memory MT5 session registry.

    Passwords are intentionally not persisted in SQLite. Restarting the API
    requires users to reconnect their broker account.
    """

    def __init__(self) -> None:
        load_dotenv()
        self._lock = RLock()
        self._sessions: dict[str, _MT5Session] = {}
        self.bridge_url = os.getenv("CORTEX_MT5_BRIDGE_URL")

    def connect(self, user: AuthUser, payload: MT5ConnectRequest) -> MT5StatusResponse:
        if self.bridge_url:
            provider = MT5BridgeMarketDataProvider(self.bridge_url)
            account = provider.connect(payload.model_dump())
            with self._lock:
                self._sessions[user.id] = _MT5Session(credentials=None, account=account, bridge_url=self.bridge_url)
            return self._status_from_account(account, "Conta MT5 conectada via bridge Windows.")

        credentials = MT5Credentials(
            login=payload.login,
            password=payload.password,
            server=payload.server,
            terminal_path=payload.terminal_path,
        )
        provider = MT5MarketDataProvider(credentials)
        account = provider.get_account_info()
        with self._lock:
            self._sessions[user.id] = _MT5Session(credentials=credentials, account=account)
        return self._status_from_account(account, "Conta MT5 conectada para leitura de dados de mercado.")

    def disconnect(self, user: AuthUser) -> MT5StatusResponse:
        with self._lock:
            session = self._sessions.pop(user.id, None)
        if session and session.bridge_url:
            MT5BridgeMarketDataProvider(session.bridge_url).disconnect()
        return MT5StatusResponse(connected=False, message="Conta MT5 desconectada.")

    def status(self, user: AuthUser) -> MT5StatusResponse:
        with self._lock:
            session = self._sessions.get(user.id)
        if session is None:
            return MT5StatusResponse(connected=False, message="Nenhuma conta MT5 conectada.")
        return self._status_from_account(session.account, "Conta MT5 pronta para dados de mercado.")

    def get_provider(self, user: AuthUser) -> MarketDataProvider:
        with self._lock:
            session = self._sessions.get(user.id)
        if session is None:
            raise ValueError("Conecte uma conta MetaTrader 5 antes de usar o provider MT5.")
        if session.bridge_url:
            return MT5BridgeMarketDataProvider(session.bridge_url)
        if session.credentials is None:
            raise ValueError("Sessão MT5 inválida. Reconecte a conta.")
        return MT5MarketDataProvider(session.credentials)

    @staticmethod
    def _status_from_account(
        account: dict[str, str | int | float | bool | None],
        message: str,
    ) -> MT5StatusResponse:
        return MT5StatusResponse(
            connected=True,
            login=int(account["login"]) if account.get("login") is not None else None,
            server=str(account["server"]) if account.get("server") is not None else None,
            name=str(account["name"]) if account.get("name") is not None else None,
            company=str(account["company"]) if account.get("company") is not None else None,
            currency=str(account["currency"]) if account.get("currency") is not None else None,
            balance=float(account["balance"]) if account.get("balance") is not None else None,
            equity=float(account["equity"]) if account.get("equity") is not None else None,
            margin=float(account["margin"]) if account.get("margin") is not None else None,
            trade_allowed=bool(account["trade_allowed"]) if account.get("trade_allowed") is not None else None,
            message=message,
        )


mt5_sessions = MT5SessionManager()

