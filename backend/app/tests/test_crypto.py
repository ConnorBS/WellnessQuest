from __future__ import annotations

import pytest

from app.security.crypto import (
    PREFIX,
    SecretsDecryptError,
    decrypt_secrets,
    encrypt_secrets,
)


def test_round_trip_basic():
    plain = {"access_token": "abc-123", "url": "http://x"}
    enc = encrypt_secrets(plain)
    for v in enc.values():
        assert v.startswith(PREFIX)
    assert decrypt_secrets(enc) == plain


def test_empty_dict_no_op():
    assert encrypt_secrets({}) == {}
    assert decrypt_secrets({}) == {}


def test_already_encrypted_passes_through():
    plain = {"k": "v"}
    enc = encrypt_secrets(plain)
    twice = encrypt_secrets(enc)
    # Re-encrypting an already-encrypted dict is a no-op (same ciphertext).
    assert twice == enc
    assert decrypt_secrets(twice) == plain


def test_legacy_plaintext_falls_through():
    # Rows written before this change have plaintext values; reads should
    # not blow up — they should return the raw value verbatim.
    legacy = {"access_token": "plain-token", "webhook_id": "abcd1234"}
    assert decrypt_secrets(legacy) == legacy


def test_mixed_plaintext_and_encrypted():
    enc_partial = encrypt_secrets({"a": "secret-a"})
    enc_partial["b"] = "still-plaintext"
    out = decrypt_secrets(enc_partial)
    assert out == {"a": "secret-a", "b": "still-plaintext"}


def test_corrupted_ciphertext_raises():
    bad = {"k": f"{PREFIX}not-a-real-token"}
    with pytest.raises(SecretsDecryptError):
        decrypt_secrets(bad)


def test_non_string_values_round_trip():
    plain = {"port": 8123, "scopes": ["a", "b"], "obj": {"x": 1}}
    enc = encrypt_secrets(plain)
    assert decrypt_secrets(enc) == plain
