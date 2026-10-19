import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = BACKEND_ROOT / ".env"
DATA_DIR = BACKEND_ROOT / "data"
AUDIO_DIR = DATA_DIR / "audio"
DATABASE_PATH = DATA_DIR / "studio.db"

DEFAULT_LLM_BASE_URL = "https://api.openai.com/v1"
DEFAULT_LLM_MODEL = "gpt-4o-mini"


@dataclass(frozen=True)
class Settings:
    llm_base_url: str
    llm_api_key: str
    llm_model: str


def ensure_data_dirs() -> None:
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def get_settings() -> Settings:
    # 每次运行前重新读取，补完 .env 后无需重启服务。
    load_dotenv(ENV_PATH, override=True)
    base_url = os.getenv("LLM_BASE_URL", DEFAULT_LLM_BASE_URL).strip().rstrip("/")
    api_key = os.getenv("LLM_API_KEY", "").strip()
    model_name = os.getenv("LLM_MODEL", DEFAULT_LLM_MODEL).strip()
    return Settings(
        llm_base_url=base_url or DEFAULT_LLM_BASE_URL,
        llm_api_key=api_key,
        llm_model=model_name or DEFAULT_LLM_MODEL,
    )


def frontend_origins() -> list[str]:
    raw = os.getenv("FRONTEND_ORIGINS", "")
    defaults = [
        "http://127.0.0.1:5180",
        "http://localhost:5180",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ]
    extra = [item.strip() for item in raw.split(",") if item.strip()]
    return list(dict.fromkeys(defaults + extra))
