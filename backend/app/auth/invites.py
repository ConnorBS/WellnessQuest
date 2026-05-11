from __future__ import annotations

import hashlib
import secrets


def generate_invite_code() -> tuple[str, str]:
    raw = secrets.token_urlsafe(24)
    return raw, hash_code(raw)


def hash_code(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()
