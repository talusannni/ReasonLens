from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

import requests


GROQ_PRICING = {
    "openai/gpt-oss-120b": {"input": 0.15, "output": 0.60},
    "openai/gpt-oss-20b": {"input": 0.075, "output": 0.30},
}


def estimate_groq_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    pricing = GROQ_PRICING.get(model)
    if not pricing:
        return 0.0
    return (
        (input_tokens / 1_000_000) * pricing["input"]
        + (output_tokens / 1_000_000) * pricing["output"]
    )


@dataclass
class TraceContext:
    client: "ReasonLens"
    prompt: str
    mode: str = "chat"
    provider: str = "external"
    model: str = "unknown"
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = field(
        default_factory=lambda: __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).isoformat()
    )
    nodes: list[dict[str, Any]] = field(default_factory=list)
    edges: list[dict[str, Any]] = field(default_factory=list)
    started: float = field(default_factory=time.perf_counter)
    answer_text: str = ""
    status: str = "running"
    _last_node_id: str | None = field(default=None, init=False, repr=False)

    def __post_init__(self) -> None:
        self.nodes.append(
            {
                "id": "prompt",
                "kind": "prompt",
                "label": "User prompt",
                "detail": self.prompt,
                "metadata": {"mode": self.mode},
            }
        )
        self._last_node_id = "prompt"

    def __enter__(self) -> "TraceContext":
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> bool:
        if exc_type is None:
            self.finish()
        else:
            self.node(
                "warning",
                "Unhandled exception",
                str(exc_value or exc_type),
                {"exceptionType": getattr(exc_type, "__name__", str(exc_type))},
            )
            self.finish("failed")
        return False

    def node(
        self,
        kind: str,
        label: str,
        detail: str = "",
        metadata: dict[str, Any] | None = None,
        node_id: str | None = None,
        auto_edge: bool = True,
    ) -> str:
        nid = node_id or str(uuid.uuid4())
        self.nodes.append(
            {
                "id": nid,
                "kind": kind,
                "label": label,
                "detail": detail,
                "metadata": metadata or {},
            }
        )
        if auto_edge and self._last_node_id and self._last_node_id != nid:
            self.edge(self._last_node_id, nid, "depends_on")
        if auto_edge:
            self._last_node_id = nid
        return nid

    def edge(
        self,
        source: str,
        target: str,
        kind: str = "depends_on",
        edge_id: str | None = None,
    ) -> str:
        for existing in self.edges:
            if (
                existing["source"] == source
                and existing["target"] == target
                and existing["kind"] == kind
            ):
                return existing["id"]
        eid = edge_id or str(uuid.uuid4())
        self.edges.append(
            {"id": eid, "source": source, "target": target, "kind": kind}
        )
        return eid

    def llm(
        self,
        model: str,
        input_text: str,
        output_text: str,
        input_tokens: int = 0,
        output_tokens: int = 0,
        provider: str = "groq",
        *,
        latency_ms: int | None = None,
        request_id: str | None = None,
        finish_reason: str | None = None,
        input_messages: list[dict[str, Any]] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        self.model = model
        self.provider = provider
        node_metadata: dict[str, Any] = {
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "inputChars": len(input_text),
            "outputChars": len(output_text),
        }
        if latency_ms is not None:
            node_metadata["latencyMs"] = latency_ms
        if request_id:
            node_metadata["requestId"] = request_id
        if finish_reason:
            node_metadata["finishReason"] = finish_reason
        if input_messages is not None:
            node_metadata["inputMessages"] = input_messages
        if metadata:
            node_metadata.update(metadata)
        return self.node(
            "model",
            f"LLM · {model}",
            output_text,
            node_metadata,
        )

    def retrieval(
        self,
        query: str,
        documents: list[dict[str, Any]],
        *,
        retriever: str = "unknown",
        top_k: int | None = None,
        latency_ms: int | None = None,
    ) -> str:
        retrieval_metadata: dict[str, Any] = {
            "documentCount": len(documents),
            "retriever": retriever,
            "topK": top_k if top_k is not None else len(documents),
        }
        if latency_ms is not None:
            retrieval_metadata["latencyMs"] = latency_ms

        nid = self.node(
            "retrieval",
            "Retrieval",
            query,
            retrieval_metadata,
        )
        evidence_ids: list[str] = []

        for index, doc in enumerate(documents):
            metadata = dict(doc.get("metadata") or {})
            metadata.setdefault("rank", index + 1)
            if "score" in metadata:
                metadata["score"] = metadata["score"]
            did = str(
                doc.get("id")
                or doc.get("title")
                or f"evidence-{index + 1}"
            )
            self.node(
                "evidence",
                str(doc.get("title") or doc.get("id") or "Evidence"),
                str(doc.get("content") or ""),
                metadata,
                node_id=did,
                auto_edge=False,
            )
            self.edge(nid, did, "retrieves")
            evidence_ids.append(did)

        retrieval_node = next(n for n in self.nodes if n["id"] == nid)
        retrieval_node["metadata"]["evidenceIds"] = evidence_ids
        self._last_node_id = nid
        return nid

    def tool(
        self,
        name: str,
        input_data: Any,
        output_data: Any,
        success: bool = True,
        *,
        latency_ms: int | None = None,
        error: str | None = None,
    ) -> str:
        metadata: dict[str, Any] = {
            "success": success,
            "input": input_data,
        }
        if latency_ms is not None:
            metadata["durationMs"] = latency_ms
        if error:
            metadata["error"] = error
        return self.node(
            "tool",
            f"Tool · {name}",
            json.dumps(output_data, ensure_ascii=False, default=str),
            metadata,
        )

    def claim(
        self,
        text: str,
        supported_by: list[str] | None = None,
        *,
        confidence: float | None = None,
    ) -> str:
        metadata: dict[str, Any] = {}
        if confidence is not None:
            metadata["confidence"] = confidence
        nid = self.node("claim", "Claim", text, metadata)
        for source in supported_by or []:
            self.edge(source, nid, "supports")
        return nid

    def decision(self, text: str, *, confidence: float | None = None) -> str:
        metadata = {"confidence": confidence} if confidence is not None else {}
        return self.node("decision", "Decision", text, metadata)

    def answer(self, text: str) -> str:
        self.answer_text = text
        return self.node("answer", "Final answer", text)

    def finish(self, status: str = "completed") -> dict[str, Any]:
        self.status = status
        latency_ms = int((time.perf_counter() - self.started) * 1000)
        total_in = sum(
            int(n.get("metadata", {}).get("inputTokens", 0))
            for n in self.nodes
        )
        total_out = sum(
            int(n.get("metadata", {}).get("outputTokens", 0))
            for n in self.nodes
        )
        trace = {
            "id": self.id,
            "createdAt": self.created_at,
            "provider": self.provider,
            "model": self.model,
            "prompt": self.prompt,
            "mode": self.mode,
            "nodes": self.nodes,
            "edges": self.edges,
            "answer": self.answer_text,
            "status": status,
            "metrics": {
                "latencyMs": latency_ms,
                "inputTokens": total_in,
                "outputTokens": total_out,
                "estimatedCostUsd": (
                    estimate_groq_cost(self.model, total_in, total_out)
                    if self.provider == "groq"
                    else 0.0
                ),
            },
        }
        if self.client.ingest:
            self.client.send(trace)
        return trace


class ReasonLens:
    def __init__(
        self,
        base_url: str,
        api_key: str | None = None,
        ingest: bool = True,
        timeout: float = 10,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.ingest = ingest
        self.timeout = timeout

    def trace(self, prompt: str, mode: str = "chat") -> TraceContext:
        return TraceContext(self, prompt, mode)

    def send(self, trace: dict[str, Any]) -> None:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = "Bearer " + self.api_key
        response = requests.post(
            self.base_url + "/api/traces",
            json=trace,
            headers=headers,
            timeout=self.timeout,
        )
        response.raise_for_status()
