# ReasonLens Python SDK

Instrument an existing AI application and send observable execution traces to ReasonLens.

## Install

```bash
pip install -r requirements.txt
```

## Example

```python
from reasonlens import ReasonLens

rl = ReasonLens("https://reasonlens.vercel.app")

with rl.trace("Answer a customer question", mode="agent") as trace:
    retrieval = trace.retrieval("refund policy", [{"title":"Refund policy","content":"Refunds are allowed within 30 days."}])
    trace.tool("get_order", {"id":"123"}, {"status":"delivered"})
    claim = trace.claim("Order is eligible for refund", [retrieval])
    trace.decision("Approve refund")
    trace.answer("The order is eligible for a refund.")
```

The trace is posted to `POST /api/traces`.
