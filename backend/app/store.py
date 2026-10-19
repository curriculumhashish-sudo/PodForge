import json
import sqlite3
from datetime import UTC, datetime
from typing import Any

from app.config import DATABASE_PATH, DATA_DIR

CURRENT_WORKFLOW_ID = "studio-current"


def _connection() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH, timeout=5)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with _connection() as connection:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                document TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )


def get_current_workflow() -> dict[str, Any] | None:
    with _connection() as connection:
        row = connection.execute(
            "SELECT document, updated_at FROM workflows WHERE id = ?",
            (CURRENT_WORKFLOW_ID,),
        ).fetchone()
    if row is None:
        return None
    try:
        document = json.loads(row["document"])
    except (TypeError, ValueError):
        return None
    if not isinstance(document, dict):
        return None
    document["savedAt"] = row["updated_at"]
    return document


def save_current_workflow(document: dict[str, Any], name: str) -> str:
    saved_at = datetime.now(UTC).isoformat(timespec="seconds")
    payload = json.dumps(document, ensure_ascii=False, separators=(",", ":"))
    with _connection() as connection:
        connection.execute(
            """
            INSERT INTO workflows (id, name, document, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                document = excluded.document,
                updated_at = excluded.updated_at
            """,
            (CURRENT_WORKFLOW_ID, name, payload, saved_at),
        )
    return saved_at
