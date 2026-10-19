import asyncio
import logging
import time
from collections.abc import AsyncIterator
from uuid import uuid4

from app.engine.errors import WorkflowError
from app.engine.graph import node_label, prepare_workflow
from app.nodes import NODE_HANDLERS
from app.results import NodeResult
from app.schemas import RunRequest

logger = logging.getLogger(__name__)


async def execute_workflow(request: RunRequest) -> AsyncIterator[dict]:
    run_id = uuid4().hex
    workflow_started = time.perf_counter()

    try:
        prepared = prepare_workflow(request)
    except WorkflowError as error:
        yield {"event": "workflow_failed", "runId": run_id, "message": str(error)}
        return

    yield {
        "event": "workflow_started",
        "runId": run_id,
        "workflowName": request.name,
        "nodeCount": len(prepared.ordered_nodes),
    }

    outputs: dict[str, NodeResult] = {}
    for node in prepared.ordered_nodes:
        label = node_label(node)
        yield {
            "event": "node_started",
            "runId": run_id,
            "nodeId": node.id,
            "nodeType": node.type,
            "label": label,
        }
        started = time.perf_counter()
        try:
            upstream = [outputs[source_id] for source_id in prepared.incoming[node.id]]
            result = await NODE_HANDLERS[node.type](node, upstream, request.user_input)
        except WorkflowError as error:
            yield {
                "event": "node_failed",
                "runId": run_id,
                "nodeId": node.id,
                "nodeType": node.type,
                "label": label,
                "message": str(error),
            }
            return
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("节点执行异常: %s (%s)", node.id, node.type)
            yield {
                "event": "node_failed",
                "runId": run_id,
                "nodeId": node.id,
                "nodeType": node.type,
                "label": label,
                "message": "节点执行时出现内部错误，请查看后端日志",
            }
            return

        outputs[node.id] = result
        duration_ms = int((time.perf_counter() - started) * 1000)
        yield {
            "event": "node_finished",
            "runId": run_id,
            "nodeId": node.id,
            "nodeType": node.type,
            "label": label,
            "durationMs": duration_ms,
            "output": result.to_public(),
        }

    final_result = outputs[prepared.end_id]
    warning = None
    if not final_result.audio_url:
        warning = "本次没有生成音频。请确认「超拟人音频合成」节点已接入结束节点之前。"
    total_duration_ms = int((time.perf_counter() - workflow_started) * 1000)
    yield {
        "event": "workflow_finished",
        "runId": run_id,
        "durationMs": total_duration_ms,
        "output": final_result.to_public(),
        "warning": warning,
    }
