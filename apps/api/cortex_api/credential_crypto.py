from __future__ import annotations

import os

from cryptography.fernet import Fernet, InvalidToken
from dotenv import load_dotenv


load_dotenv()


class CredentialCipher:
    """Encrypt broker secrets before they reach persistent storage."""

    def __init__(self) -> None:
        key = os.getenv("CORTEX_BROKER_CREDENTIALS_KEY", "").strip()
        if not key:
            raise RuntimeError(
                "CORTEX_BROKER_CREDENTIALS_KEY não configurada. "
                "Defina uma chave Fernet antes de persistir credenciais de corretora."
            )
        try:
            self._fernet = Fernet(key.encode("ascii"))
        except (ValueError, UnicodeEncodeError) as exc:
            raise RuntimeError("CORTEX_BROKER_CREDENTIALS_KEY inválida.") from exc

    def encrypt(self, plaintext: str) -> str:
        return self._fernet.encrypt(plaintext.encode("utf-8")).decode("ascii")

    def decrypt(self, ciphertext: str) -> str:
        try:
            return self._fernet.decrypt(ciphertext.encode("ascii")).decode("utf-8")
        except (InvalidToken, UnicodeError) as exc:
            raise RuntimeError("Não foi possível descriptografar a credencial da corretora.") from exc


credential_cipher = CredentialCipher()
