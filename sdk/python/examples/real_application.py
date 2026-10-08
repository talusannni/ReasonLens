"""ReasonLens real-application integration test.

Runs real Groq calls and instruments:
  1. chat
  2. RAG
  3. tool/agent workflow
  4. intentional model failure
  5. latency/token/cost metadata

Environment:
  GROQ_API_KEY             required
  REASONLENS_URL            default https://reasonlens.vercel.app
  REASONLENS_INGEST_KEY     required for ingestion
  GROQ_MODEL                default openai/gpt-oss-120b

Run:
  python sdk/python/examples/real_application.py
"""
from __future__ import annotations

import json
import os
import time
from typing import Any

import requests

from reasonlens import ReasonLens


GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_KEY = os.environ["GROQ_API_KEY"]
REASONLENS_URL = os.getenv("REASONLENS_URL", "https://reasonlens.vercel.app")
INGEST_KEY = os.environ["REASONLENS_INGEST_KEY"]

rl = ReasonLens(REASONLENS_URL, INGEST_KEY, ingest=True, timeout=15)


def groq(messages: list[dict[str, str]], trace, label: str) -> tuple[str, dict[str, int]]:
    started = time.perf_counter()
    response = requests.post(
        GROQ_URL,
        headers={"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"},
        json={
            "model": MODEL,
            "messages": messages,
            "temperature": 0.1,
        },
        timeout=60,
    )
    latency_ms = int((time.perf_counter() - started) * 1000)

    if not response.ok:
        raise RuntimeError(f"Groq {response.status_code}: {response.text}")

    data = response.json()
    content = data["choices"][0]["message"]["content"]
    usage = data.get("usage") or {}
    usage_meta = {
        "input_tokens": int(usage.get("prompt_tokens", 0)),
        "output_tokens": int(usage.get("completion_tokens", 0)),
    }

    trace.node(
        "analysis",
        label,
        f"Groq completed in {latency_ms} ms",
        {"latencyMs": latency_ms},
    )
    trace.llm(
        MODEL,
        json.dumps(messages),
        content,
        usage_meta["input_tokens"],
        usage_meta["output_tokens"],
        provider="groq",
    )
    return content, usage_meta


def run_chat() -> None:
    prompt = "Explain why a production AI application should trace retrieval, model calls, tools, and final decisions."
    with rl.trace(prompt, "chat") as trace:
        answer, _ = groq(
            [{"role": "user", "content": prompt}],
            trace,
            "Chat model call",
        )
        trace.answer(answer)
    print("CHAT: completed")


def run_rag() -> None:
    prompt = "Can a customer get a refund after 25 days?"
    documents = [
        {
            "id": "refund-policy",
            "title": "Refund Policy",
            "content": "Customers may request a refund within 30 days of purchase.",
            "metadata": {"source": "internal-policy", "score": 0.97},
        },
        {
            "id": "shipping-policy",
            "title": "Shipping Policy",
            "content": "Standard delivery takes 3 to 5 business days.",
            "metadata": {"source": "internal-policy", "score": 0.31},
        },
    ]

    with rl.trace(prompt, "rag") as trace:
        retrieval_id = trace.retrieval(prompt, documents)
        context = "\n\n".join(
            f"{d['title']}: {d['content']}" for d in documents if d["metadata"]["score"] >= 0.9
        )
        answer, _ = groq(
            [
                {
                    "role": "system",
                    "content": "Answer only from the supplied evidence. If evidence is insufficient, say so.",
                },
                {"role": "user", "content": f"Question: {prompt}\nEvidence:\n{context}"},
            ],
            trace,
            "RAG answer model",
        )
        claim_id = trace.claim("Refund eligibility is supported by the 30-day policy.", [retrieval_id])
        decision_id = trace.decision("Customer is eligible for a refund.")
        trace.edge(claim_id, decision_id, "depends_on")
        trace.answer(answer)
    print("RAG: completed")


def lookup_order(order_id: str) -> dict[str, Any]:
    # Deterministic local business tool. In a real application this could be
    # an HTTP request to an order-management service.
    return {"orderId": order_id, "status": "delivered", "daysSincePurchase": 12}


def run_agent() -> None:
    prompt = "Check order 123 and tell me whether it is eligible for a refund."
    with rl.trace(prompt, "agent") as trace:
        plan = trace.node(
            "analysis",
            "Agent plan",
            "Identify the order, inspect its status and purchase age, then apply refund policy.",
        )

        tool_result = lookup_order("123")
        tool_id = trace.tool("get_order", {"id": "123"}, tool_result, success=True)
        trace.edge(plan, tool_id, "calls")

        policy = trace.retrieval(
            "refund eligibility",
            [{
                "id": "refund-policy",
                "title": "Refund Policy",
                "content": "Customers may request a refund within 30 days of purchase.",
                "metadata": {"source": "internal-policy"},
            }],
        )

        answer, _ = groq(
            [
                {
                    "role": "system",
                    "content": "Decide refund eligibility from the order data and policy. Give a concise answer.",
                },
                {
                    "role": "user",
                    "content": (
                        f"Order: {json.dumps(tool_result)}\n"
                        "Policy: refund allowed within 30 days."
                    ),
                },
            ],
            trace,
            "Agent final model",
        )

        decision = trace.decision("Order is within the 30-day refund window.")
        trace.edge(tool_id, decision, "produces")
        trace.edge(policy, decision, "supports")
        trace.answer(answer)
    print("AGENT: completed")


def run_failure() -> None:
    prompt = "Intentional failure test: call an invalid Groq model."
    trace = rl.trace(prompt, "chat")
    try:
        trace.node("warning", "Intentional failure", "This test should produce a failed trace.")
        response = requests.post(
            GROQ_URL,
            headers={"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"},
            json={"model": "reasonlens-invalid-model", "messages": [{"role": "user", "content": "test"}]},
            timeout=30,
        )
        if response.ok:
            raise RuntimeError("Expected Groq to reject the invalid model.")
        trace.node("warning", "Groq error", response.text[:1000], {"httpStatus": response.status_code})
        trace.answer(f"Expected failure captured: HTTP {response.status_code}")
        trace.finish("failed")
        print("FAILURE: captured expected Groq error")
    except Exception as exc:
        trace.node("warning", "Unhandled failure", str(exc))
        trace.answer(f"Failure captured: {exc}")
        trace.finish("failed")
        print("FAILURE: captured exception")


def main() -> None:
    print(f"ReasonLens: {REASONLENS_URL}")
    print(f"Groq model: {MODEL}")
    print()
    run_chat()
    run_rag()
    run_agent()
    run_failure()
    print()
    print("All four scenarios completed. Open ReasonLens and inspect the newest traces.")


if __name__ == "__main__":
    main()
