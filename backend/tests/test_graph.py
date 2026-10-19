import unittest

from app.engine.errors import WorkflowError
from app.engine.graph import prepare_workflow
from app.schemas import GraphEdge, GraphNode, RunRequest


def node(node_id: str, node_type: str, label: str | None = None) -> GraphNode:
    data = {"label": label} if label else {}
    return GraphNode(id=node_id, type=node_type, data=data)


def edge(edge_id: str, source: str, target: str) -> GraphEdge:
    return GraphEdge(id=edge_id, source=source, target=target)


def request(nodes: list[GraphNode], edges: list[GraphEdge], text: str = "聊聊今晚的播客") -> RunRequest:
    return RunRequest(name="测试工作流", nodes=nodes, edges=edges, userInput=text)


VALID_NODES = [
    node("input", "userInput"),
    node("llm", "llm"),
    node("tts", "tts"),
    node("end", "end"),
]
VALID_EDGES = [
    edge("e1", "input", "llm"),
    edge("e2", "llm", "tts"),
    edge("e3", "tts", "end"),
]


class PrepareWorkflowTests(unittest.TestCase):
    def test_valid_chain_is_ordered(self) -> None:
        prepared = prepare_workflow(request(VALID_NODES, VALID_EDGES))
        self.assertEqual([item.type for item in prepared.ordered_nodes], ["userInput", "llm", "tts", "end"])
        self.assertEqual(prepared.incoming["end"], ["tts"])

    def test_graph_with_branch_keeps_valid_order(self) -> None:
        nodes = VALID_NODES + [node("llm2", "llm")]
        edges = [
            edge("e1", "input", "llm"),
            edge("e2", "input", "llm2"),
            edge("e3", "llm", "tts"),
            edge("e4", "llm2", "tts"),
            edge("e5", "tts", "end"),
        ]
        prepared = prepare_workflow(request(nodes, edges))
        order = [item.id for item in prepared.ordered_nodes]
        self.assertLess(order.index("input"), order.index("llm"))
        self.assertLess(order.index("llm"), order.index("tts"))

    def test_missing_input_is_rejected(self) -> None:
        with self.assertRaisesRegex(WorkflowError, "用户输入"):
            prepare_workflow(request([item for item in VALID_NODES if item.type != "userInput"], VALID_EDGES))

    def test_cycle_is_rejected(self) -> None:
        edges = VALID_EDGES + [edge("e4", "tts", "llm")]
        with self.assertRaisesRegex(WorkflowError, "主链路"):
            prepare_workflow(request(VALID_NODES, edges))

    def test_detached_node_is_rejected(self) -> None:
        nodes = VALID_NODES + [node("extra", "llm", "孤立模型")]
        with self.assertRaisesRegex(WorkflowError, "孤立模型"):
            prepare_workflow(request(nodes, VALID_EDGES))

    def test_duplicate_edge_is_ignored(self) -> None:
        prepared = prepare_workflow(request(VALID_NODES, VALID_EDGES + [edge("e4", "llm", "tts")]))
        self.assertEqual(prepared.incoming["tts"], ["llm"])

    def test_blank_input_is_rejected(self) -> None:
        with self.assertRaisesRegex(WorkflowError, "输入"):
            prepare_workflow(request(VALID_NODES, VALID_EDGES, text="   "))

    def test_unsupported_node_is_rejected(self) -> None:
        nodes = VALID_NODES + [node("unknown", "webhook")]
        edges = VALID_EDGES + [edge("e4", "llm", "unknown"), edge("e5", "unknown", "tts")]
        with self.assertRaisesRegex(WorkflowError, "暂不支持"):
            prepare_workflow(request(nodes, edges))


if __name__ == "__main__":
    unittest.main()
