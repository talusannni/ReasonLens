# ReasonLens Python SDK

Instrument an existing AI application and send observable execution traces to ReasonLens.

## Install

```bash
pip install -r requirements.txt
```

## Basic example

```python
from reasonlens import ReasonLens

rl = ReasonLens("https://reasonlens.vercel.app")

with rl.trace("Answer a customer question", mode="agent") as trace:
    retrieval = trace.retrieval(
        "refund policy",
        [{"title": "Refund policy", "content": "Refunds are allowed within 30 days."}],
    )
    trace.tool("get_order", {"id": "123"}, {"status": "delivered"})
    claim = trace.claim("Order is eligible for refund", [retrieval])
    trace.decision("Approve refund")
    trace.answer("The order is eligible for a refund.")
```

## Real document RAG test

Generate real PDF and DOCX fixtures:

```bash
python sdk/python/examples/generate_document_fixtures.py
```

Then run the instrumented application:

```bash
python sdk/python/examples/document_rag.py
```

The document test uses real PDF/DOCX parsing, deterministic retrieval, and a real Groq completion. It records document parsing, chunks, retrieval, evidence provenance, claims, decisions, latency, tokens, cost, and the final answer.

Required environment:

```text
GROQ_API_KEY=<your Groq key>
REASONLENS_URL=https://reasonlens.vercel.app
REASONLENS_INGEST_KEY=<your ReasonLens ingest key>
GROQ_MODEL=openai/gpt-oss-120b
```


## Provenance edge-case test

Generate a trace containing supported, contradicted, and unsupported claims:

```bash
PYTHONPATH=sdk/python python sdk/python/examples/provenance_edge_cases.py
```

Open the newest trace in ReasonLens and inspect **Answer Provenance**. The audit should distinguish the three claim states and lower the provenance score for the contradicted and unsupported claims.
