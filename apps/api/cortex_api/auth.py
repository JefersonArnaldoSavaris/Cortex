from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import Cookie, Depends, Header, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from .db import session_scope
from .models import AuthUser, ForgotPasswordRequest, LoginRequest, RegisterRequest, UserPlan, UserRole, UserStatus
from .favorite_repository import add_default_favorites
from .orm import UserORM

AUTH_COOKIE_NAME = "cortex_session"
TOKEN_TYPE = "access"
ACCESS_TOKEN_MINUTES = int(os.getenv("CORTEX_ACCESS_TOKEN_MINUTES", "120"))
COOKIE_SECURE = os.getenv("CORTEX_AUTH_COOKIE_SECURE", "false").lower() == "true"
JWT_SECRET = os.getenv("CORTEX_AUTH_SECRET") or os.getenv("SECRET_KEY") or "dev-cortex-auth-secret-change-me"
PASSWORD_ITERATIONS = int(os.getenv("CORTEX_PASSWORD_ITERATIONS", "260000"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("CORTEX_AUTH_RATE_LIMIT_WINDOW_SECONDS", "60"))
RATE_LIMIT_MAX_ATTEMPTS = int(os.getenv("CORTEX_AUTH_RATE_LIMIT_MAX_ATTEMPTS", "20"))

_rate_limit_buckets: dict[str, deque[float]] = defaultdict(deque)
_password_reset_requests: list[dict[str, str]] = []


def _b64url_encode(payload: bytes) -> str:
    return base64.urlsafe_b64encode(payload).rstrip(b"=").decode("ascii")


def _b64url_decode(payload: str) -> bytes:
    padding = "=" * (-len(payload) % 4)
    return base64.urlsafe_b64decode(payload + padding)


def _json_dumps(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${_b64url_encode(salt)}${_b64url_encode(digest)}"


def verify_password(password: str, password_hash: str) -> bool:
    try:
        algorithm, iterations, salt, expected = password_hash.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), _b64url_decode(salt), int(iterations))
        return hmac.compare_digest(_b64url_encode(digest), expected)
    except (TypeError, ValueError):
        return False


def _sign_token(signing_input: str) -> str:
    digest = hmac.new(JWT_SECRET.encode("utf-8"), signing_input.encode("ascii"), hashlib.sha256).digest()
    return _b64url_encode(digest)


def create_access_token(user: UserORM) -> str:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user.id,
        "email": user.email,
        "role": user.role,
        "plan": user.plan,
        "type": TOKEN_TYPE,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    signing_input = f"{_b64url_encode(_json_dumps(header))}.{_b64url_encode(_json_dumps(payload))}"
    return f"{signing_input}.{_sign_token(signing_input)}"


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        encoded_header, encoded_payload, signature = token.split(".", 2)
        signing_input = f"{encoded_header}.{encoded_payload}"
        if not hmac.compare_digest(_sign_token(signing_input), signature):
            raise ValueError("invalid signature")
        payload = json.loads(_b64url_decode(encoded_payload))
        if payload.get("type") != TOKEN_TYPE:
            raise ValueError("invalid token type")
        if int(payload.get("exp", 0)) < int(time.time()):
            raise ValueError("expired token")
        return payload
    except (ValueError, TypeError, json.JSONDecodeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida ou expirada.")


def to_auth_user(user: UserORM) -> AuthUser:
    return AuthUser(
        id=user.id,
        name=user.name,
        email=user.email,
        role=UserRole(user.role),
        plan=UserPlan(user.plan),
        status=UserStatus(user.status),
        created_at=user.created_at,
        updated_at=user.updated_at,
        last_login_at=user.last_login_at,
    )


def _rate_limit_key(request: Request, action: str) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    client_host = forwarded_for or (request.client.host if request.client else "unknown")
    return f"{action}:{client_host}"


def enforce_auth_rate_limit(request: Request, action: str) -> None:
    now = time.time()
    bucket = _rate_limit_buckets[_rate_limit_key(request, action)]
    while bucket and now - bucket[0] > RATE_LIMIT_WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= RATE_LIMIT_MAX_ATTEMPTS:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Muitas tentativas. Aguarde um pouco e tente novamente.")
    bucket.append(now)


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        AUTH_COOKIE_NAME,
        token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=ACCESS_TOKEN_MINUTES * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(AUTH_COOKIE_NAME, path="/", samesite="lax", secure=COOKIE_SECURE, httponly=True)


def register_user(payload: RegisterRequest) -> AuthUser:
    now = datetime.now()
    user = UserORM(
        id=str(uuid4()),
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=UserRole.USER.value,
        plan=UserPlan.FREE.value,
        status=UserStatus.TRIAL.value,
        created_at=now,
        updated_at=now,
    )
    try:
        with session_scope() as session:
            session.add(user)
            session.flush()
            add_default_favorites(session, user.id)
            session.refresh(user)
            return to_auth_user(user)
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este e-mail já está cadastrado.")


def authenticate_user(payload: LoginRequest) -> tuple[AuthUser, str]:
    with session_scope() as session:
        user = session.scalar(select(UserORM).where(UserORM.email == payload.email))
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="E-mail ou senha inválidos.")
        if user.status == UserStatus.BLOCKED.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta bloqueada. Entre em contato com o suporte.")
        if user.status == UserStatus.INACTIVE.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta inativa.")
        user.last_login_at = datetime.now()
        user.updated_at = user.last_login_at
        session.flush()
        session.refresh(user)
        return to_auth_user(user), create_access_token(user)


def request_password_reset(payload: ForgotPasswordRequest) -> None:
    _password_reset_requests.append({"email": payload.email, "requested_at": datetime.now(timezone.utc).isoformat()})


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def get_current_user(
    authorization: str | None = Header(default=None),
    cookie_token: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME),
) -> AuthUser:
    token = cookie_token or _extract_bearer_token(authorization)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Autenticação necessária.")
    return get_user_from_token(token)


def get_user_from_token(token: str) -> AuthUser:
    payload = decode_access_token(token)
    user_id = str(payload.get("sub") or "")
    with session_scope() as session:
        user = session.get(UserORM, user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado.")
        if user.status in {UserStatus.BLOCKED.value, UserStatus.INACTIVE.value}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta sem acesso.")
        return to_auth_user(user)


CurrentUser = Depends(get_current_user)
