from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from hushh_mcp.services.world_model_service import WorldModelService


class _StubDomainRegistry:
    async def ensure_canonical_domains(self):
        return None

    async def register_domain(self, _domain: str):
        return None


class _StubSupabaseTable:
    def __init__(self):
        self.last_upsert_data = None
        self.last_on_conflict = None

    def upsert(self, data, on_conflict=None):
        self.last_upsert_data = data
        self.last_on_conflict = on_conflict
        return self

    def execute(self):
        return SimpleNamespace(data=[self.last_upsert_data], error=None)


class _StubSupabase:
    def __init__(self):
        self.table_name = None
        self.table_stub = _StubSupabaseTable()

    def table(self, name: str):
        self.table_name = name
        return self.table_stub


@pytest.mark.asyncio
async def test_store_domain_data_uses_blob_upsert_rpc_and_skips_fallback_work(monkeypatch):
    service = WorldModelService()
    service._domain_registry = _StubDomainRegistry()
    service._blob_upsert_rpc_supported = True

    rpc_calls = []

    def _fake_run_rpc(function_name: str, params=None):
        rpc_calls.append((function_name, params))
        return SimpleNamespace(data=9, error=None)

    monkeypatch.setattr(service, "_run_rpc", _fake_run_rpc)

    update_summary_mock = AsyncMock(return_value=True)
    fallback_get_data_mock = AsyncMock(return_value={"data_version": 4})
    reconcile_mock = AsyncMock(return_value=True)
    monkeypatch.setattr(service, "update_domain_summary", update_summary_mock)
    monkeypatch.setattr(service, "get_encrypted_data", fallback_get_data_mock)
    monkeypatch.setattr(service, "reconcile_user_index_domains", reconcile_mock)

    success = await service.store_domain_data(
        user_id="user-1",
        domain="financial",
        encrypted_blob={
            "ciphertext": "ciphertext-1",
            "iv": "iv-1",
            "tag": "tag-1",
            "algorithm": "AES-256-GCM",
        },
        summary={"holdings_count": 2},
    )

    assert success is True
    assert rpc_calls[0][0] == "upsert_world_model_data_blob"
    assert rpc_calls[0][1]["p_algorithm"] == "aes-256-gcm"
    fallback_get_data_mock.assert_not_called()
    reconcile_mock.assert_not_called()
    update_summary_mock.assert_awaited_once()


@pytest.mark.asyncio
async def test_store_domain_data_fallback_increments_data_version_when_rpc_unavailable(monkeypatch):
    service = WorldModelService()
    service._domain_registry = _StubDomainRegistry()
    service._supabase = _StubSupabase()
    service._blob_upsert_rpc_supported = True

    def _broken_run_rpc(_function_name: str, _params=None):
        raise RuntimeError("rpc missing")

    monkeypatch.setattr(service, "_run_rpc", _broken_run_rpc)
    monkeypatch.setattr(
        service,
        "get_encrypted_data",
        AsyncMock(return_value={"data_version": 4}),
    )
    monkeypatch.setattr(service, "update_domain_summary", AsyncMock(return_value=True))
    monkeypatch.setattr(service, "reconcile_user_index_domains", AsyncMock(return_value=True))

    success = await service.store_domain_data(
        user_id="user-2",
        domain="financial",
        encrypted_blob={
            "ciphertext": "ciphertext-2",
            "iv": "iv-2",
            "tag": "tag-2",
            "algorithm": "aes-256-gcm",
        },
        summary={"holdings_count": 1},
    )

    assert success is True
    assert service._supabase.table_name == "world_model_data"
    assert service._supabase.table_stub.last_on_conflict == "user_id"
    assert service._supabase.table_stub.last_upsert_data["data_version"] == 5
