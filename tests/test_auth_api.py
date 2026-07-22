import importlib
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException, Response

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture()
def auth_modules(tmp_path, monkeypatch):
    monkeypatch.setenv("CORTEX_DATABASE_URL", f"sqlite:///{tmp_path / 'auth-test.db'}")
    monkeypatch.setenv("CORTEX_AUTH_SECRET", "test-secret")
    monkeypatch.setenv("CORTEX_PASSWORD_ITERATIONS", "1000")

    import apps.api.cortex_api.auth as auth_module
    import apps.api.cortex_api.db as db_module
    import apps.api.cortex_api.main as main_module
    import apps.api.cortex_api.models as models_module
    import apps.api.cortex_api.orm as orm_module
    import apps.api.cortex_api.repository as repository_module

    importlib.reload(db_module)
    importlib.reload(orm_module)
    importlib.reload(repository_module)
    auth_module = importlib.reload(auth_module)
    main_module = importlib.reload(main_module)

    repository_module.init_db()
    return auth_module, main_module, models_module


def _register_payload(models_module, email: str = "ana@example.com", password: str = "Cortex8!"):
    return models_module.RegisterRequest(
        name="Ana Cortex",
        email=email,
        password=password,
        accepted_terms=True,
    )


def _register(auth_modules, email: str = "ana@example.com", password: str = "Cortex8!"):
    auth_module, _, models_module = auth_modules
    return auth_module.register_user(_register_payload(models_module, email=email, password=password))


@pytest.mark.unit
def test_register_user(auth_modules):
    user = _register(auth_modules)

    assert user.email == "ana@example.com"
    assert user.role == "user"
    assert user.plan == "free"
    assert user.status == "trial"
    assert not hasattr(user, "password_hash")


@pytest.mark.unit
def test_login_valid(auth_modules):
    auth_module, _, models_module = auth_modules
    _register(auth_modules)

    user, token = auth_module.authenticate_user(models_module.LoginRequest(email="ana@example.com", password="Cortex8!"))

    assert user.email == "ana@example.com"
    assert auth_module.decode_access_token(token)["sub"] == user.id


@pytest.mark.unit
def test_login_invalid_email(auth_modules):
    auth_module, _, models_module = auth_modules

    with pytest.raises(HTTPException) as exc:
        auth_module.authenticate_user(models_module.LoginRequest(email="naoexiste@example.com", password="Cortex8!"))

    assert exc.value.status_code == 401
    assert exc.value.detail == "E-mail ou senha inválidos."


@pytest.mark.unit
def test_login_wrong_password(auth_modules):
    auth_module, _, models_module = auth_modules
    _register(auth_modules)

    with pytest.raises(HTTPException) as exc:
        auth_module.authenticate_user(models_module.LoginRequest(email="ana@example.com", password="Errada8!"))

    assert exc.value.status_code == 401
    assert exc.value.detail == "E-mail ou senha inválidos."


@pytest.mark.unit
def test_duplicate_email(auth_modules):
    auth_module, _, models_module = auth_modules
    _register(auth_modules)

    with pytest.raises(HTTPException) as exc:
        auth_module.register_user(_register_payload(models_module))

    assert exc.value.status_code == 409
    assert exc.value.detail == "Este e-mail já está cadastrado."


@pytest.mark.unit
def test_protected_route_without_auth(auth_modules):
    auth_module, _, _ = auth_modules

    with pytest.raises(HTTPException) as exc:
        auth_module.get_current_user(authorization=None, cookie_token=None)

    assert exc.value.status_code == 401
    assert exc.value.detail == "Autenticação necessária."


@pytest.mark.unit
def test_protected_route_with_auth(auth_modules):
    auth_module, main_module, models_module = auth_modules
    _register(auth_modules)
    user, token = auth_module.authenticate_user(models_module.LoginRequest(email="ana@example.com", password="Cortex8!"))
    current_user = auth_module.get_current_user(cookie_token=token)

    response = main_module.list_analyses(current_user)

    assert current_user.email == user.email
    assert response.analyses == []


@pytest.mark.unit
def test_auth_me(auth_modules):
    auth_module, main_module, models_module = auth_modules
    _register(auth_modules)
    _, token = auth_module.authenticate_user(models_module.LoginRequest(email="ana@example.com", password="Cortex8!"))
    current_user = auth_module.get_current_user(cookie_token=token)

    response = main_module.auth_me(current_user)

    assert response.user.name == "Ana Cortex"


@pytest.mark.unit
def test_auth_login_sets_cookie(auth_modules):
    _, main_module, models_module = auth_modules
    _register(auth_modules)
    response = Response()

    body = main_module.auth_login(
        models_module.LoginRequest(email="ana@example.com", password="Cortex8!"),
        request=type("Request", (), {"headers": {}, "client": type("Client", (), {"host": "testclient"})()})(),
        response=response,
    )

    assert body.user.email == "ana@example.com"
    assert "cortex_session=" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]


@pytest.mark.unit
def test_forgot_password_returns_safe_message(auth_modules):
    _, main_module, models_module = auth_modules

    response = main_module.auth_forgot_password(
        models_module.ForgotPasswordRequest(email="ana@example.com"),
        request=type("Request", (), {"headers": {}, "client": type("Client", (), {"host": "testclient"})()})(),
    )

    assert "enviaremos instruções" in response.message

