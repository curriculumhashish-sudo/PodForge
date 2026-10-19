import re

import httpx

from app.config import get_settings
from app.engine.errors import WorkflowError
from app.nodes.common import pick_text, read_model_name, read_temperature, to_spoken_text
from app.results import NodeResult
from app.schemas import GraphNode

DEFAULT_SYSTEM_PROMPT = (
    "你是一位专业的中文播客编剧，擅长把任何主题写成自然、真诚、适合倾听的单人口播。"
    "请把用户给出的主题或草稿改写成直接可以朗读的播客讲稿。要求：口语化，句子短，有起承转合；"
    "开头自然吸引人，结尾有余韵；篇幅控制在 220 到 360 个汉字；"
    "不要标题、不要分点、不要舞台提示、不要表情符号、不要 Markdown；只输出口播正文。"
)

LOCAL_STORIES = (
    "\n忙完一天之后，我们的大脑其实还在高速运转。消息、没处理完的工作、明天要做的事，"
    "很容易一起挤进来。这时候，一档节奏舒缓、内容不费力的播客，就像在房间里留了一盏小灯。\n"
    "它不会要求你立刻回应，也不用你盯着屏幕。你可以一边散步、收拾房间，或者只是躺着，"
    "让声音慢慢把注意力接过去。很多创作者会把停顿、呼吸和语气都留给耳朵，这些细节反而让人放松。\n"
    "当然，听播客不是为了逃避，而是给自己一点缓冲。等情绪落下来，再回头看那些问题，往往会清楚一点。\n"
    "今天就聊到这里。愿你今晚有一段安静的时间，也有一档刚刚好的节目。我们下期再见。"
)


def compose_local_podcast_script(source_text: str) -> tuple[str, str]:
    cleaned = re.sub(r"\s+", " ", source_text).strip()
    if not cleaned:
        raise WorkflowError("没有可以整理成口播稿的文字")

    detail = "未配置大模型密钥，已使用本地口播整理器"
    if len(cleaned) <= 80:
        topic = cleaned.strip("，。！？,.!?;；:： ") or "今天想和你聊的一件小事"
        script = (
            f"晚上好，欢迎来到今天的节目。今天想和你说一个很简单的话题：{topic}。"
            + LOCAL_STORIES
        )
        return script[:2400], detail

    body = cleaned[:900].rstrip(" ，,、;；")
    if body[-1:] not in "。！？!?":
        body += "。"
    if body.startswith("大家好") or body.startswith("欢迎收听"):
        return body, detail
    script = f"欢迎收听今天的节目。先把这件事慢慢说给你听。\n{body}\n今天就聊到这里，感谢你的收听。我们下期再见。"
    return script[:2400], detail


def read_message_text(content: object) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, dict):
                parts.append(str(part.get("text") or ""))
            else:
                parts.append(str(part))
        return "".join(parts).strip()
    return ""


async def request_chat_completion(
    base_url: str,
    api_key: str,
    model_name: str,
    temperature: float,
    system_prompt: str,
    user_text: str,
) -> str:
    request_body = {
        "model": model_name,
        "temperature": temperature,
        "max_tokens": 1200,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ],
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    timeout = httpx.Timeout(90.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                json=request_body,
                headers=headers,
            )
    except httpx.TimeoutException as error:
        raise WorkflowError("大模型响应超时，请稍后重试") from error
    except httpx.HTTPError as error:
        raise WorkflowError("大模型接口连接失败，请检查 LLM_BASE_URL 和网络") from error

    if response.status_code == 401 or response.status_code == 403:
        raise WorkflowError("大模型密钥无效或没有访问权限，请检查 LLM_API_KEY")
    if response.status_code >= 400:
        raise WorkflowError(f"大模型接口返回 {response.status_code}，请检查模型名称和账户额度")

    try:
        payload = response.json()
    except ValueError as error:
        raise WorkflowError("大模型接口返回了无法解析的内容") from error

    choices = payload.get("choices") if isinstance(payload, dict) else None
    if not isinstance(choices, list) or not choices:
        raise WorkflowError("大模型接口没有返回候选结果")
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else ""
    spoken = to_spoken_text(read_message_text(content))
    if not spoken:
        raise WorkflowError("大模型没有返回可朗读的文本")
    return spoken


async def execute_llm(node: GraphNode, upstream: list[NodeResult], user_text: str) -> NodeResult:
    source_text = pick_text(upstream) or user_text.strip()
    if not source_text:
        raise WorkflowError("大模型节点没有收到可处理的文字")

    settings = get_settings()
    system_prompt = str(node.data.get("systemPrompt") or "").strip() or DEFAULT_SYSTEM_PROMPT
    temperature = read_temperature(node.data.get("temperature"))
    model_name = read_model_name(node.data.get("model"), settings.llm_model)

    if not settings.llm_api_key:
        script, detail = compose_local_podcast_script(source_text)
        return NodeResult(text=script, provider="local", detail=detail)

    script = await request_chat_completion(
        base_url=settings.llm_base_url,
        api_key=settings.llm_api_key,
        model_name=model_name,
        temperature=temperature,
        system_prompt=system_prompt,
        user_text=source_text,
    )
    detail = model_name
    if len(script) > 2400:
        cutoff = max(script.rfind(mark, 0, 2400) for mark in "。！？!?")
        script = script[: cutoff + 1] if cutoff > 0 else script[:2400]
        detail = f"{model_name} · 已精简为适合朗读的长度"
    return NodeResult(text=script, provider="llm", detail=detail)
