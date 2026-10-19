import json
import re
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from app.config import AUDIO_DIR, BACKEND_ROOT, ensure_data_dirs, frontend_origins, get_settings
from app.engine.executor import execute_workflow
from app.schemas import RunRequest, WorkflowDocument
from app.store import get_current_workflow, init_db, save_current_workflow
from app.voices import VOICES

FRONTEND_DIST = BACKEND_ROOT.parent / "frontend" / "dist"
AUDIO_FILE_PATTERN = re.compile(r"[0-9a-f]{32}\.mp3")


def clean_old_audio() -> None:
    ensure_data_dirs()
    expire_before = time.time() - 24 * 60 * 60
    for audio_file in AUDIO_DIR.glob("*.mp3"):
        try:
            if audio_file.stat().st_mtime < expire_before:
                audio_file.unlink()
        except OSError:
            continue


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    ensure_data_dirs()
    init_db()
    clean_old_audio()
    yield


app = FastAPI(
    title="PaiAgent Studio API",
    description="可视化 AI 播客工作流：DAG 编排、流式执行与超拟人语音合成。",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins(),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, __: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content={"message": "请求参数不正确，请刷新重试"})


@app.get("/api/health")
def health() -> dict[str, object]:
    settings = get_settings()
    return {
        "ok": True,
        "engine": "dag",
        "llmConfigured": bool(settings.llm_api_key),
        "llmModel": settings.llm_model,
        "ttsProvider": "Edge Neural TTS",
    }


@app.get("/api/studio")
def studio() -> dict[str, object]:
    settings = get_settings()
    return {
        "voices": VOICES,
        "llmConfigured": bool(settings.llm_api_key),
        "llmModel": settings.llm_model,
        "ttsProvider": "Edge Neural TTS",
        "workflow": get_current_workflow(),
    }


@app.get("/api/voices")
def list_voices() -> dict[str, object]:
    settings = get_settings()
    return {
        "voices": VOICES,
        "llmConfigured": bool(settings.llm_api_key),
        "ttsProvider": "Edge Neural TTS",
    }


@app.get("/api/workflows/current")
def current_workflow() -> dict[str, object]:
    workflow = get_current_workflow()
    if workflow is None:
        raise HTTPException(status_code=404, detail="还没有保存过工作流")
    return workflow


@app.put("/api/workflows/current")
def save_workflow(document: WorkflowDocument) -> dict[str, object]:
    name = document.name.strip() or "AI 播客工作流"
    payload = document.model_dump(mode="json")
    payload["name"] = name
    saved_at = save_current_workflow(payload, name)
    return {**payload, "savedAt": saved_at}


@app.post("/api/workflows/run")
async def run_workflow(request: RunRequest) -> StreamingResponse:
    async def stream() -> AsyncIterator[str]:
        async for event in execute_workflow(request):
            yield json.dumps(event, ensure_ascii=False) + "\n"

    return StreamingResponse(
        stream(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/audio/{file_name}")
def get_audio(file_name: str) -> FileResponse:
    if not AUDIO_FILE_PATTERN.fullmatch(file_name):
        raise HTTPException(status_code=404, detail="音频不存在")
    audio_path = (AUDIO_DIR / file_name).resolve()
    if audio_path.parent != AUDIO_DIR.resolve() or not audio_path.is_file():
        raise HTTPException(status_code=404, detail="音频不存在")
    return FileResponse(
        audio_path,
        media_type="audio/mpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="studio")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "PaiAgent Studio API",
        "docs": "/docs",
        "studio": "http://127.0.0.1:5180",
    }
