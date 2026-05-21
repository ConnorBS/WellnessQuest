"""Fernet encryption for at-rest JSONB secrets columns.

Values in the `integrations.secrets` JSONB column are stored as strings of the
form ``"v1:<urlsafe-b64-fernet-token>"``. Keys are stored plaintext so the
column remains debuggable. Reads transparently fall through plaintext values so
rows predating this change keep working; the next write upgrades them to v1.
"""
from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

PREFIX = "v1:"


class SecretsDecryptError(RuntimeError):
    """Raised when an encrypted value is present but decryption fails."""


@lru_cache(maxsize=1)
def _cipher() -> Fernet:
    key = settings.fernet_key
    if not key:
        raise RuntimeError("FERNET_KEY is not set; required to read/write secrets")
    try:
        return Fernet(key.encode("ascii") if isinstance(key, str) else key)
    except (ValueError, TypeError) as exc:
        raise RuntimeError(
            "FERNET_KEY is not a valid Fernet key (32 url-safe base64 bytes)"
        ) from exc


def _looks_encrypted(value: Any) -> bool:
    return isinstance(value, str) and value.startswith(PREFIX)


def encrypt_secrets(secrets: dict[str, Any]) -> dict[str, str]:
    """Encrypt every value (already-encrypted values pass through unchanged)."""
    cipher = _cipher()
    out: dict[str, str] = {}
    for k, v in secrets.items():
        if _looks_encrypted(v):
            out[k] = v
            continue
        token = cipher.encrypt(json.dumps(v).encode("utf-8")).decode("ascii")
        out[k] = f"{PREFIX}{token}"
    return out


def decrypt_secrets(secrets: dict[str, Any]) -> dict[str, Any]:
    """Decrypt v1 values; pass through plaintext (legacy) values verbatim."""
    if not secrets:
        return {}
    cipher = _cipher()
    out: dict[str, Any] = {}
    for k, v in secrets.items():
        if not _looks_encrypted(v):
            out[k] = v
            continue
        token = v[len(PREFIX):].encode("ascii")
        try:
            plaintext = cipher.decrypt(token)
        except InvalidToken as exc:
            raise SecretsDecryptError(f"failed to decrypt secret '{k}'") from exc
        out[k] = json.loads(plaintext.decode("utf-8"))
    return out


def ensure_fernet_key_valid() -> None:
    """Call at startup to fail fast if FERNET_KEY is missing/invalid."""
    _cipher()
