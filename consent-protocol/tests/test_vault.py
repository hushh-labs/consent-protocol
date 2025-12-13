# tests/test_vault.py

import pytest
import json
import base64
from hushh_mcp.vault.encrypt import encrypt_data, decrypt_data
from hushh_mcp.config import VAULT_ENCRYPTION_KEY
from hushh_mcp.types import EncryptedPayload


def test_encrypt_decrypt_roundtrip():
    payload = {
        "email": "alice@hushh.ai",
        "preferences": {
            "category": "electronics",
            "frequency": "weekly"
        }
    }
    plaintext = json.dumps(payload)

    encrypted: EncryptedPayload = encrypt_data(plaintext, VAULT_ENCRYPTION_KEY)
    decrypted = decrypt_data(encrypted, VAULT_ENCRYPTION_KEY)

    assert isinstance(decrypted, str)
    assert decrypted == plaintext


def test_decryption_fails_with_wrong_key():
    plaintext = "sensitive data"
    encrypted = encrypt_data(plaintext, VAULT_ENCRYPTION_KEY)

    # Generate fake key (32-byte hex)
    wrong_key = "9f" * 32  # 64 hex chars

    with pytest.raises(ValueError, match="Invalid authentication tag"):
        decrypt_data(encrypted, wrong_key)


def test_decryption_fails_with_tampered_data():
    plaintext = "user@hushh.ai"
    encrypted = encrypt_data(plaintext, VAULT_ENCRYPTION_KEY)

    # Tamper with ciphertext
    corrupted = encrypted.copy(update={
        "ciphertext": base64.b64encode(b"malicious content").decode("utf-8")
    })

    with pytest.raises(Exception, match="Decryption failed"):
        decrypt_data(corrupted, VAULT_ENCRYPTION_KEY)
