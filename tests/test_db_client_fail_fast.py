from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from db.db_client import DatabaseClient, DatabaseExecutionError, TableQuery


@pytest.fixture
def sqlite_engine():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE vault_key_wrappers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    method TEXT NOT NULL,
                    encrypted_vault_key TEXT NOT NULL,
                    salt TEXT NOT NULL,
                    iv TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    UNIQUE(user_id, method)
                )
                """
            )
        )
        conn.commit()
    return engine


def test_execute_raises_database_execution_error_for_sql_failures(sqlite_engine):
    query = TableQuery("missing_table", sqlite_engine)
    query.select("*")

    with pytest.raises(DatabaseExecutionError, match="missing_table.select"):
        query.execute()


def test_upsert_supports_composite_conflict_columns(sqlite_engine):
    first = TableQuery("vault_key_wrappers", sqlite_engine)
    first.upsert(
        {
            "user_id": "user-1",
            "method": "passphrase",
            "encrypted_vault_key": "enc-v1",
            "salt": "salt-v1",
            "iv": "iv-v1",
            "created_at": 1000,
            "updated_at": 1000,
        },
        on_conflict="user_id,method",
    ).execute()

    second = TableQuery("vault_key_wrappers", sqlite_engine)
    second.upsert(
        {
            "user_id": "user-1",
            "method": "passphrase",
            "encrypted_vault_key": "enc-v2",
            "salt": "salt-v2",
            "iv": "iv-v2",
            "created_at": 9999,  # must not overwrite immutable column on conflict
            "updated_at": 2000,
        },
        on_conflict="user_id,method",
    ).execute()

    with sqlite_engine.connect() as conn:
        row = conn.execute(
            text(
                """
                SELECT encrypted_vault_key, salt, iv, created_at, updated_at
                FROM vault_key_wrappers
                WHERE user_id = :user_id AND method = :method
                """
            ),
            {"user_id": "user-1", "method": "passphrase"},
        ).fetchone()

    assert row is not None
    assert row.encrypted_vault_key == "enc-v2"
    assert row.salt == "salt-v2"
    assert row.iv == "iv-v2"
    assert row.created_at == 1000
    assert row.updated_at == 2000


def test_execute_raw_commits_insert_returning_statements(sqlite_engine):
    with sqlite_engine.connect() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE developer_apps (
                    app_id TEXT PRIMARY KEY,
                    display_name TEXT NOT NULL
                )
                """
            )
        )
        conn.commit()

    db = DatabaseClient(engine=sqlite_engine)
    result = db.execute_raw(
        """
        INSERT INTO developer_apps (app_id, display_name)
        VALUES (:app_id, :display_name)
        RETURNING app_id, display_name
        """,
        {"app_id": "app_demo_123", "display_name": "Demo App"},
    )

    assert result.count == 1
    assert result.data[0]["app_id"] == "app_demo_123"

    with sqlite_engine.connect() as conn:
        row = conn.execute(
            text("SELECT app_id, display_name FROM developer_apps WHERE app_id = :app_id"),
            {"app_id": "app_demo_123"},
        ).fetchone()

    assert row is not None
    assert row.app_id == "app_demo_123"
    assert row.display_name == "Demo App"
