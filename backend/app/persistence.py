"""Transactional workspace revisions; retained snapshots prevent silent overwrite."""
from contextlib import contextmanager
import json
import sqlite3
from datetime import datetime, timezone
from . import runtime


@contextmanager
def connection():
    runtime.DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(runtime.DATA_DIR / 'workspace.sqlite3', timeout=20)
    db.execute('PRAGMA journal_mode=WAL')
    db.execute('CREATE TABLE IF NOT EXISTS revisions (revision INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, payload TEXT NOT NULL)')
    db.execute('CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY, created_at TEXT NOT NULL, event TEXT NOT NULL, metadata TEXT NOT NULL)')
    try:
        with db:
            yield db
    finally:
        db.close()


def read_workspace():
    with connection() as db:
        row = db.execute('SELECT revision, payload FROM revisions ORDER BY revision DESC LIMIT 1').fetchone()
    return {'revision': row[0], 'state': json.loads(row[1])} if row else {'revision': 0, 'state': None}


def save_workspace(state, expected_revision):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT MAX(revision) FROM revisions').fetchone()
        current = row[0] or 0
        if expected_revision != current:
            raise ValueError('Workspace changed in another window. Reload before saving; export your current work first.')
        cursor = db.execute('INSERT INTO revisions(created_at, payload) VALUES (?, ?)', (datetime.now(timezone.utc).isoformat(), json.dumps(state)))
        revision = cursor.lastrowid
        # Keep a bounded recovery history; project baselines live in every full snapshot.
        db.execute('DELETE FROM revisions WHERE revision < ?', (revision - 50,))
    return revision


def record(event, metadata):
    with connection() as db:
        db.execute('INSERT INTO events(created_at,event,metadata) VALUES (?,?,?)', (datetime.now(timezone.utc).isoformat(), event, json.dumps(metadata)))
