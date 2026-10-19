from app.engine.errors import WorkflowError
from app.nodes.common import pick_audio, pick_text
from app.results import NodeResult
from app.schemas import GraphNode


async def execute_end(node: GraphNode, upstream: list[NodeResult], user_text: str) -> NodeResult:
    del node, user_text
    if not upstream:
        raise WorkflowError("结束节点还没有连入上游")
    detail = "汇总工作流输出"
    for result in reversed(upstream):
        if result.audio_url and result.detail:
            detail = result.detail
            break
    return NodeResult(
        text=pick_text(upstream),
        audio_url=pick_audio(upstream),
        provider="end",
        detail=detail,
    )
