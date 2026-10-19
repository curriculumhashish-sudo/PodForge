from dataclasses import dataclass


@dataclass
class NodeResult:
    text: str
    audio_url: str | None = None
    provider: str | None = None
    detail: str | None = None

    def to_public(self) -> dict[str, str | None]:
        return {
            "text": self.text,
            "audioUrl": self.audio_url,
            "provider": self.provider,
            "detail": self.detail,
        }
