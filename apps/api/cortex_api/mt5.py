from __future__ import annotations

from dataclasses import dataclass
import os
from threading import RLock

from dotenv import load_dotenv

from cortex.trading_opportunities.providers import MarketDataProvider, MT5BridgeMarketDataProvider, MT5Credentials, MT5MarketDataProvider

from .broker_repository import deactivate_broker_connection, get_active_broker_connection, record_broker_error, save_broker_connection
from .credential_crypto import credential_cipher
from .models import AuthUser, MT5ConnectRequest, MT5StatusResponse, MT5Symbol


@dataclass
class _MT5Session:
    credentials: MT5Credentials | None
    account: dict[str, str | int | float | bool | None]
    bridge_url: str | None = None


class MT5SessionManager:
    """Per-user MT5 sessions backed by encrypted persistent credentials."""

    def __init__(self) -> None:
        load_dotenv()
        self._lock = RLock()
        self._sessions: dict[str, _MT5Session] = {}
        self.bridge_url = os.getenv("CORTEX_MT5_BRIDGE_URL")

    def connect(self, user: AuthUser, payload: MT5ConnectRequest) -> MT5StatusResponse:
        if self.bridge_url:
            provider = MT5BridgeMarketDataProvider(self.bridge_url)
            account = provider.connect(payload.model_dump())
            self._persist_connection(user, payload, account)
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
        self._persist_connection(user, payload, account)
        with self._lock:
            self._sessions[user.id] = _MT5Session(credentials=credentials, account=account)
        return self._status_from_account(account, "Conta MT5 conectada para leitura de dados de mercado.")

    def disconnect(self, user: AuthUser) -> MT5StatusResponse:
        with self._lock:
            session = self._sessions.pop(user.id, None)
        if session and session.bridge_url:
            MT5BridgeMarketDataProvider(session.bridge_url).disconnect()
        deactivate_broker_connection(user.id)
        return MT5StatusResponse(connected=False, message="Conta MT5 desconectada.")

    def status(self, user: AuthUser) -> MT5StatusResponse:
        with self._lock:
            session = self._sessions.get(user.id)
        if session is None:
            session = self._restore_session(user)
        if session is None:
            return MT5StatusResponse(connected=False, message="Nenhuma conta MT5 conectada.")
        return self._status_from_account(session.account, "Conta MT5 restaurada e pronta para dados de mercado.")

    def get_provider(self, user: AuthUser) -> MarketDataProvider:
        with self._lock:
            session = self._sessions.get(user.id)
        if session is None:
            session = self._restore_session(user)
        if session is None:
            raise ValueError("Conecte uma conta MetaTrader 5 antes de usar o provider MT5.")
        if session.bridge_url:
            return MT5BridgeMarketDataProvider(session.bridge_url)
        if session.credentials is None:
            raise ValueError("Sessão MT5 inválida. Reconecte a conta.")
        return MT5MarketDataProvider(session.credentials)

    def list_symbols(self, user: AuthUser, query: str = "", limit: int = 500) -> list[MT5Symbol]:
        provider = self.get_provider(user)
        if not hasattr(provider, "list_symbols"):
            raise ValueError("O provider MT5 atual não oferece catálogo de símbolos.")
        return [MT5Symbol.model_validate(item) for item in provider.list_symbols(query=query, limit=limit)]

    def get_tick(self, user: AuthUser, symbol: str) -> dict:
        provider = self.get_provider(user)
        if not hasattr(provider, "get_market_tick"):
            raise ValueError("O provider MT5 atual não oferece ticks em tempo real.")
        return provider.get_market_tick(symbol)

    def _persist_connection(self, user: AuthUser, payload: MT5ConnectRequest, account: dict) -> None:
        save_broker_connection(
            user_id=user.id,
            login=payload.login,
            server=payload.server,
            encrypted_password=credential_cipher.encrypt(payload.password),
            terminal_path=payload.terminal_path,
            account=account,
        )

    def _restore_session(self, user: AuthUser) -> _MT5Session | None:
        stored = get_active_broker_connection(user.id)
        if stored is None:
            return None
        try:
            credentials = MT5Credentials(
                login=int(stored["login"]),
                password=credential_cipher.decrypt(stored["encrypted_password"]),
                server=str(stored["server"]),
                terminal_path=stored.get("terminal_path"),
            )
            if self.bridge_url:
                provider = MT5BridgeMarketDataProvider(self.bridge_url)
                account = provider.connect(
                    {
                        "login": credentials.login,
                        "password": credentials.password,
                        "server": credentials.server,
                        "terminal_path": credentials.terminal_path,
                    }
                )
                session = _MT5Session(credentials=None, account=account, bridge_url=self.bridge_url)
            else:
                session = _MT5Session(credentials=credentials, account=stored["account"])
            with self._lock:
                self._sessions[user.id] = session
            return session
        except Exception as exc:
            record_broker_error(user.id, str(exc))
            raise ValueError(f"Não foi possível restaurar a conexão MT5: {exc}") from exc

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
