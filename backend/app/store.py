import json
from datetime import datetime, timezone
from pathlib import Path

STORE = Path(__file__).resolve().parent.parent / "data.json"

def load() -> dict:
    if not STORE.exists():
        return {"projects": {}, "audit": []}
    return json.loads(STORE.read_text())

def record(event: str, payload: dict) -> dict:
    data = load()
    entry = {"event": event, "at": datetime.now(timezone.utc).isoformat(), **payload}
    data["audit"].append(entry)
    STORE.write_text(json.dumps(data, indent=2))
    return entry
