from app.engine.errors import WorkflowError
from app.results import NodeResult
from app.schemas import GraphNode


async def execute_user_input(node: GraphNode, upstream: list[NodeResult], user_text: str) -> NodeResult:
    del node, upstream
    stripped = user_text.strip()
    if not stripped:
        raise WorkflowError("请先在调试抽屉输入测试文字")
    return NodeResult(text=stripped, provider="user", detail="调试输入")
