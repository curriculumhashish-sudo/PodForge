import re

from app.results import NodeResult


def pick_text(upstream: list[NodeResult]) -> str:
    for result in reversed(upstream):
        stripped = result.text.strip()
        if stripped:
            return stripped
    return ""


def pick_audio(upstream: list[NodeResult]) -> str | None:
    for result in reversed(upstream):
        if result.audio_url:
            return result.audio_url
    return None


def read_temperature(value: object) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return 0.7
    try:
        temperature = float(value)
    except (TypeError, ValueError):
        return 0.7
    return max(0.0, min(1.5, temperature))


def read_rate_percent(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return 0
    try:
        rate_percent = int(float(value))
    except (TypeError, ValueError):
        return 0
    return max(-30, min(30, rate_percent))


def read_pitch_hz(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return 0
    try:
        pitch_hz = int(float(value))
    except (TypeError, ValueError):
        return 0
    return max(-50, min(50, pitch_hz))


def read_model_name(value: object, fallback: str) -> str:
    if not isinstance(value, str):
        return fallback
    model_name = value.strip()
    if not model_name or len(model_name) > 80:
        return fallback
    return model_name


def to_spoken_text(raw: str) -> str:
    lines: list[str] = []
    for line in raw.splitlines():
        cleaned = line.strip()
        cleaned = re.sub(r"^#{1,6}\s*", "", cleaned)
        cleaned = cleaned.replace("**", "").replace("__", "").replace("`", "")
        cleaned = re.sub(r"^>\s*", "", cleaned)
        cleaned = re.sub(r"^[\-*•]\s*", "", cleaned)
        cleaned = re.sub(
            r"[\U0001F300-\U0001FAFF\U00002700-\U000027BF\U00002600-\U000026FF]",
            "",
            cleaned,
        )
        if cleaned:
            lines.append(cleaned)
    return "\n".join(lines).strip()
