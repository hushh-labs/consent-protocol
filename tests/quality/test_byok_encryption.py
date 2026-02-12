# tests/quality/test_byok_encryption.py
"""
BYOK (Bring Your Own Key) Encryption Verification Tests

Verifies that the client-side encryption (lib/vault/encrypt.ts) is compatible
with decryption and that keys are properly derived from user passphrases.

These tests simulate the encryption flow without touching hushh_mcp core.
"""

import base64
import os

import pytest
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


# Simulate the frontend key derivation (matches passphrase-key.ts)
def derive_vault_key(passphrase: str, salt: bytes, iterations: int = 100000) -> bytes:
    """
    Derive a 256-bit vault key from passphrase using PBKDF2.
    This matches the frontend implementation in passphrase-key.ts.
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,  # 256 bits
        salt=salt,
        iterations=iterations,
    )
    return kdf.derive(passphrase.encode())


def encrypt_data_aes_gcm(plaintext: str, key: bytes) -> dict:
    """
    Encrypt data using AES-256-GCM (matches encrypt.ts).
    Returns dict with ciphertext, iv, tag (all base64 encoded).
    """
    aesgcm = AESGCM(key)
    iv = os.urandom(12)  # 96-bit IV for GCM

    ciphertext_with_tag = aesgcm.encrypt(iv, plaintext.encode(), None)

    # Split ciphertext and tag (last 16 bytes)
    ciphertext = ciphertext_with_tag[:-16]
    tag = ciphertext_with_tag[-16:]

    return {
        "ciphertext": base64.b64encode(ciphertext).decode(),
        "iv": base64.b64encode(iv).decode(),
        "tag": base64.b64encode(tag).decode(),
        "encoding": "base64",
        "algorithm": "aes-256-gcm",
    }


def decrypt_data_aes_gcm(payload: dict, key: bytes) -> str:
    """
    Decrypt AES-256-GCM encrypted data (matches encrypt.ts).
    """
    aesgcm = AESGCM(key)

    ciphertext = base64.b64decode(payload["ciphertext"])
    iv = base64.b64decode(payload["iv"])
    tag = base64.b64decode(payload["tag"])

    # Combine ciphertext and tag for decryption
    combined = ciphertext + tag

    plaintext = aesgcm.decrypt(iv, combined, None)
    return plaintext.decode()


class TestBYOKKeyDerivation:
    """Test key derivation from user passphrase."""

    def test_key_derivation_produces_256_bit_key(self):
        """Key should be exactly 256 bits (32 bytes)."""
        passphrase = "my_secure_passphrase_123!"  # noqa: S105
        salt = os.urandom(16)

        key = derive_vault_key(passphrase, salt)

        assert len(key) == 32, "Key should be 32 bytes (256 bits)"

    def test_same_passphrase_same_salt_produces_same_key(self):
        """Deterministic derivation with same inputs."""
        passphrase = "test_passphrase"  # noqa: S105
        salt = b"fixed_salt_1234!"

        key1 = derive_vault_key(passphrase, salt)
        key2 = derive_vault_key(passphrase, salt)

        assert key1 == key2, "Same passphrase + salt should produce same key"

    def test_different_passphrase_produces_different_key(self):
        """Different passphrase should produce different key."""
        salt = b"fixed_salt_1234!"

        key1 = derive_vault_key("passphrase_a", salt)
        key2 = derive_vault_key("passphrase_b", salt)

        assert key1 != key2, "Different passphrases should produce different keys"

    def test_different_salt_produces_different_key(self):
        """Different salt should produce different key."""
        passphrase = "same_passphrase"  # noqa: S105

        key1 = derive_vault_key(passphrase, b"salt_aaaaaaaaaaa")
        key2 = derive_vault_key(passphrase, b"salt_bbbbbbbbbbb")

        assert key1 != key2, "Different salts should produce different keys"


class TestBYOKEncryption:
    """Test AES-256-GCM encryption/decryption."""

    @pytest.fixture
    def vault_key(self):
        """Generate a test vault key."""
        return os.urandom(32)

    def test_encrypt_decrypt_roundtrip(self, vault_key):
        """Data should decrypt to original plaintext."""
        original = '{"dietary_restrictions": "vegetarian", "allergies": ["nuts"]}'

        encrypted = encrypt_data_aes_gcm(original, vault_key)
        decrypted = decrypt_data_aes_gcm(encrypted, vault_key)

        assert decrypted == original, "Decrypted data should match original"

    def test_encrypted_payload_structure(self, vault_key):
        """Encrypted payload should have correct structure."""
        encrypted = encrypt_data_aes_gcm("test data", vault_key)

        assert "ciphertext" in encrypted
        assert "iv" in encrypted
        assert "tag" in encrypted
        assert encrypted["encoding"] == "base64"
        assert encrypted["algorithm"] == "aes-256-gcm"

    def test_ciphertext_is_different_each_time(self, vault_key):
        """Random IV should produce different ciphertext each time."""
        plaintext = "same data"

        encrypted1 = encrypt_data_aes_gcm(plaintext, vault_key)
        encrypted2 = encrypt_data_aes_gcm(plaintext, vault_key)

        assert encrypted1["ciphertext"] != encrypted2["ciphertext"], (
            "Different IVs should produce different ciphertexts"
        )

    def test_invalid_key_fails_decryption(self, vault_key):
        """Decryption with wrong key should fail."""
        encrypted = encrypt_data_aes_gcm("secret data", vault_key)

        wrong_key = os.urandom(32)

        with pytest.raises(InvalidTag):
            decrypt_data_aes_gcm(encrypted, wrong_key)

    def test_tampered_ciphertext_fails(self, vault_key):
        """Tampered ciphertext should fail authentication."""
        encrypted = encrypt_data_aes_gcm("original data", vault_key)

        # Tamper with ciphertext
        tampered_cipher = base64.b64decode(encrypted["ciphertext"])
        tampered_cipher = bytes([tampered_cipher[0] ^ 0xFF]) + tampered_cipher[1:]
        encrypted["ciphertext"] = base64.b64encode(tampered_cipher).decode()

        with pytest.raises(InvalidTag):
            decrypt_data_aes_gcm(encrypted, vault_key)

    def test_tampered_tag_fails(self, vault_key):
        """Tampered authentication tag should fail."""
        encrypted = encrypt_data_aes_gcm("original data", vault_key)

        # Tamper with tag
        tampered_tag = base64.b64decode(encrypted["tag"])
        tampered_tag = bytes([tampered_tag[0] ^ 0xFF]) + tampered_tag[1:]
        encrypted["tag"] = base64.b64encode(tampered_tag).decode()

        with pytest.raises(InvalidTag):
            decrypt_data_aes_gcm(encrypted, vault_key)


class TestBYOKCrossPlatformCompatibility:
    """
    Test that Python encryption is compatible with TypeScript decrypt.

    Note: These tests verify the format matches what encrypt.ts produces.
    Full cross-platform testing requires running both Python and TS.
    """

    def test_iv_is_12_bytes(self):
        """GCM IV should be 12 bytes (96 bits)."""
        key = os.urandom(32)
        encrypted = encrypt_data_aes_gcm("test", key)

        iv = base64.b64decode(encrypted["iv"])
        assert len(iv) == 12, "IV should be 12 bytes for AES-GCM"

    def test_tag_is_16_bytes(self):
        """GCM tag should be 16 bytes (128 bits)."""
        key = os.urandom(32)
        encrypted = encrypt_data_aes_gcm("test", key)

        tag = base64.b64decode(encrypted["tag"])
        assert len(tag) == 16, "Tag should be 16 bytes for AES-GCM"

    def test_base64_encoding_is_valid(self):
        """All base64 fields should be valid base64."""
        key = os.urandom(32)
        encrypted = encrypt_data_aes_gcm("test data", key)

        # Should not raise on valid base64
        base64.b64decode(encrypted["ciphertext"])
        base64.b64decode(encrypted["iv"])
        base64.b64decode(encrypted["tag"])
