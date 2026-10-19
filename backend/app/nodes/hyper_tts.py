import asyncio
from uuid import uuid4

import edge_tts

from app.config import AUDIO_DIR
from app.engine.errors import WorkflowError
from app.nodes.common import pick_text, read_pitch_hz, read_rate_percent
from app.results import NodeResult
from app.schemas import GraphNode
from app.voices import DEFAULT_VOICE_ID, VOICE_MAP

MAX_TTS_CHARACTERS = 3000


def shorten_error(error: Exception) -> str:
    message = " ".join(str(error).split())
    if not message:
        return "未知错误"
    return message[:140] + ("…" if len(message) > 140 else "")


async def synthesize(text: str, voice_id: str, rate_percent: int, pitch_hz: int, output_path) -> None:
    communicate = edge_tts.Communicate(
        text,
        voice=voice_id,
        rate=f"{rate_percent:+d}%",
        pitch=f"{pitch_hz:+d}Hz",
    )
    await communicate.save(str(output_path))


async def execute_tts(node: GraphNode, upstream: list[NodeResult], user_text: str) -> NodeResult:
    del user_text
    spoken_text = pick_text(upstream)
    if not spoken_text:
        raise WorkflowError("超拟人音频合成节点没有收到可朗读的文本")
    if len(spoken_text) > MAX_TTS_CHARACTERS:
        raise WorkflowError(f"口播稿超过 {MAX_TTS_CHARACTERS} 字，请缩短后再合成")

    voice_id = str(node.data.get("voice") or DEFAULT_VOICE_ID)
    voice = VOICE_MAP.get(voice_id)
    if voice is None:
        raise WorkflowError("选择的音色不可用，请在右侧节点设置中重新选择")

    rate_percent = read_rate_percent(node.data.get("ratePercent"))
    pitch_hz = read_pitch_hz(node.data.get("pitchHz"))
    file_name = f"{uuid4().hex}.mp3"
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    output_path = AUDIO_DIR / file_name

    last_error: Exception | None = None
    for attempt in range(2):
        try:
            await synthesize(spoken_text, voice_id, rate_percent, pitch_hz, output_path)
            if output_path.is_file() and output_path.stat().st_size > 256:
                break
            last_error = RuntimeError("语音服务返回了空音频")
        except Exception as error:  # noqa: BLE001 - edge_tts 的异常类型不稳定
            last_error = error
        output_path.unlink(missing_ok=True)
        if attempt == 0:
            await asyncio.sleep(0.6)
    else:
        raise WorkflowError(f"超拟人音频合成失败：{shorten_error(last_error or RuntimeError())}")

    voice_label = f"{voice['name']} · {voice['tone']}"
    return NodeResult(
        text=spoken_text,
        audio_url=f"/api/audio/{file_name}",
        provider="edge-neural",
        detail=voice_label,
    )
