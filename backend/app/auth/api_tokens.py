from __future__ import annotations

import hashlib
import secrets

TOKEN_PREFIX = "wq_ha_"  # noqa: S105 - public prefix, not a secret


def generate_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hash). Show raw_token exactly once; store the hash."""
    raw = TOKEN_PREFIX + secrets.token_urlsafe(32)
    return raw, hash_token(raw)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def is_token_format(value: str) -> bool:
    return value.startswith(TOKEN_PREFIX) and len(value) > len(TOKEN_PREFIX)
