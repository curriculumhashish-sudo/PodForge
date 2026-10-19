import heapq
from dataclasses import dataclass

from app.engine.errors import WorkflowError
from app.nodes import NODE_HANDLERS
from app.schemas import GraphEdge, GraphNode, RunRequest

NODE_TYPE_LABELS = {
    "userInput": "用户输入",
    "llm": "大模型",
    "tts": "超拟人音频合成",
    "end": "结束",
}


@dataclass(frozen=True)
class PreparedWorkflow:
    ordered_nodes: list[GraphNode]
    incoming: dict[str, list[str]]
    input_id: str
    end_id: str


def node_label(node: GraphNode) -> str:
    label = node.data.get("label")
    if isinstance(label, str) and label.strip():
        return label.strip()
    return NODE_TYPE_LABELS.get(node.type, node.type)


def _reachable(start_id: str, adjacency: dict[str, list[str]]) -> set[str]:
    visited = {start_id}
    stack = [start_id]
    while stack:
        current = stack.pop()
        for next_id in adjacency[current]:
            if next_id in visited:
                continue
            visited.add(next_id)
            stack.append(next_id)
    return visited


def _topological_order(
    nodes: list[GraphNode],
    incoming: dict[str, list[str]],
    outgoing: dict[str, list[str]],
) -> list[GraphNode]:
    node_map = {node.id: node for node in nodes}
    order_index = {node.id: index for index, node in enumerate(nodes)}
    indegree = {node.id: len(incoming[node.id]) for node in nodes}
    pending = [
        (0 if node.type == "userInput" else 1, order_index[node.id], node.id)
        for node in nodes
        if indegree[node.id] == 0
    ]
    heapq.heapify(pending)
    ordered: list[GraphNode] = []
    while pending:
        _, _, node_id = heapq.heappop(pending)
        ordered.append(node_map[node_id])
        for target_id in outgoing[node_id]:
            indegree[target_id] -= 1
            if indegree[target_id] == 0:
                heapq.heappush(pending, (0, order_index[target_id], target_id))
    if len(ordered) != len(nodes):
        raise WorkflowError("主链路中存在循环连线，请断开形成环路的连线")
    return ordered


def _build_adjacency(
    nodes: list[GraphNode],
    edges: list[GraphEdge],
) -> tuple[dict[str, list[str]], dict[str, list[str]]]:
    node_map = {node.id: node for node in nodes}
    incoming: dict[str, list[str]] = {node.id: [] for node in nodes}
    outgoing: dict[str, list[str]] = {node.id: [] for node in nodes}
    seen_pairs: set[tuple[str, str]] = set()

    for edge in edges:
        if edge.source not in node_map or edge.target not in node_map:
            raise WorkflowError("存在指向不存在节点的连线，请重新连接")
        if edge.source == edge.target:
            raise WorkflowError("节点不能连接到自身")
        pair = (edge.source, edge.target)
        if pair in seen_pairs:
            continue
        seen_pairs.add(pair)
        incoming[edge.target].append(edge.source)
        outgoing[edge.source].append(edge.target)

    return incoming, outgoing


def prepare_workflow(request: RunRequest) -> PreparedWorkflow:
    if not request.nodes:
        raise WorkflowError("画布上还没有节点")
    if not request.user_input.strip():
        raise WorkflowError("请先在调试抽屉输入测试文字")

    node_map: dict[str, GraphNode] = {}
    for node in request.nodes:
        if node.id in node_map:
            raise WorkflowError("画布中存在重复的节点编号")
        if node.type not in NODE_HANDLERS:
            raise WorkflowError(f"暂不支持节点类型：{node.type}")
        node_map[node.id] = node

    input_nodes = [node for node in request.nodes if node.type == "userInput"]
    end_nodes = [node for node in request.nodes if node.type == "end"]
    if len(input_nodes) != 1:
        raise WorkflowError("工作流需要且只能有一个用户输入节点")
    if len(end_nodes) != 1:
        raise WorkflowError("工作流需要且只能有一个结束节点")

    incoming, outgoing = _build_adjacency(request.nodes, request.edges)
    input_id = input_nodes[0].id
    end_id = end_nodes[0].id

    if incoming[input_id]:
        raise WorkflowError("用户输入节点不能有上游连线，请断开后重试")
    if outgoing[end_id]:
        raise WorkflowError("结束节点不能继续向下游连线")

    from_input = _reachable(input_id, outgoing)
    to_end = _reachable(end_id, incoming)
    detached = [
        node
        for node in request.nodes
        if node.id not in from_input or node.id not in to_end
    ]
    if detached:
        names = "、".join(f"「{node_label(node)}」" for node in detached[:3])
        more = " 等" if len(detached) > 3 else ""
        raise WorkflowError(f"节点 {names}{more}未接入「用户输入 → 结束」主链路，请检查连线")

    ordered = _topological_order(request.nodes, incoming, outgoing)
    return PreparedWorkflow(
        ordered_nodes=ordered,
        incoming=incoming,
        input_id=input_id,
        end_id=end_id,
    )
