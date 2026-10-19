from collections.abc import Awaitable, Callable

from app.nodes.end import execute_end
from app.nodes.hyper_tts import execute_tts
from app.nodes.llm import execute_llm
from app.nodes.user_input import execute_user_input
from app.results import NodeResult
from app.schemas import GraphNode

NodeHandler = Callable[[GraphNode, list[NodeResult], str], Awaitable[NodeResult]]

NODE_HANDLERS: dict[str, NodeHandler] = {
    "userInput": execute_user_input,
    "llm": execute_llm,
    "tts": execute_tts,
    "end": execute_end,
}
