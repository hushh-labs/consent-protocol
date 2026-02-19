import pytest

from hushh_mcp.services.vault_keys_service import VaultKeysService


class _FakeResponse:
    def __init__(self, data):
        self.data = data


class _FakeTable:
    def __init__(self, row=None):
        self._row = row
        self.last_upsert = None

    def select(self, _fields):
        return self

    def eq(self, _key, _value):
        return self

    def limit(self, _count):
        return self

    def upsert(self, data, on_conflict=None):
        self.last_upsert = {"data": data, "on_conflict": on_conflict}
        return self

    def execute(self):
        if self.last_upsert is not None:
            return _FakeResponse(data=[self.last_upsert["data"]])
        if self._row is None:
            return _FakeResponse(data=[])
        return _FakeResponse(data=[self._row])


class _FakeSupabase:
    def __init__(self, row=None):
        self._table = _FakeTable(row=row)

    def table(self, _name):
        return self._table


@pytest.mark.asyncio
async def test_get_vault_key_returns_optional_key_mode_metadata():
    row = {
        "auth_method": "generated_default_web_prf",
        "key_mode": "generated_default_web_prf",
        "encrypted_vault_key": "enc",
        "salt": "salt",
        "iv": "iv",
        "recovery_encrypted_vault_key": "recoveryEnc",
        "recovery_salt": "recoverySalt",
        "recovery_iv": "recoveryIv",
        "passkey_credential_id": "cred-123",
        "passkey_prf_salt": "prf-salt-123",
    }
    service = VaultKeysService()
    service._supabase = _FakeSupabase(row=row)

    result = await service.get_vault_key("user-1")

    assert result is not None
    assert result["authMethod"] == "generated_default_web_prf"
    assert result["keyMode"] == "generated_default_web_prf"
    assert result["passkeyCredentialId"] == "cred-123"
    assert result["passkeyPrfSalt"] == "prf-salt-123"


@pytest.mark.asyncio
async def test_setup_vault_persists_optional_key_mode_metadata():
    service = VaultKeysService()
    fake_supabase = _FakeSupabase()
    service._supabase = fake_supabase

    await service.setup_vault(
        user_id="user-1",
        auth_method="generated_default_native_biometric",
        key_mode="generated_default_native_biometric",
        encrypted_vault_key="enc",
        salt="salt",
        iv="iv",
        recovery_encrypted_vault_key="recoveryEnc",
        recovery_salt="recoverySalt",
        recovery_iv="recoveryIv",
        passkey_credential_id=None,
        passkey_prf_salt=None,
    )

    payload = fake_supabase._table.last_upsert["data"]
    assert payload["auth_method"] == "generated_default_native_biometric"
    assert payload["key_mode"] == "generated_default_native_biometric"
    assert "passkey_credential_id" in payload
    assert "passkey_prf_salt" in payload
