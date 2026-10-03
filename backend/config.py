import os
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SESSION_DIR = BASE_DIR / "session"
SESSION_DIR.mkdir(parents=True, exist_ok=True)
SESSION_FILE = SESSION_DIR / "telegram_account"
CONFIG_FILE = BASE_DIR / "config.json"
BLACKLIST_FILE = SESSION_DIR / "blacklist.json"

DEFAULT_CONFIG = {
    "api_id": None,
    "api_hash": "",
    "phone": "",
    "last_paid_channel_id": None,
    "last_free_group_id": None,
    "safe_delay_seconds": 1.5
}

def load_config() -> dict:
    if CONFIG_FILE.exists():
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {**DEFAULT_CONFIG, **data}
        except Exception:
            return DEFAULT_CONFIG.copy()
    return DEFAULT_CONFIG.copy()

def save_config(new_config: dict) -> dict:
    current = load_config()
    current.update(new_config)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(current, f, indent=2)
    return current

def load_blacklist() -> list:
    if BLACKLIST_FILE.exists():
        try:
            with open(BLACKLIST_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_blacklist(data: list) -> list:
    with open(BLACKLIST_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return data

