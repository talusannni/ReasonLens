"""Generate a deliberately mixed-quality provenance trace."""
import os
from reasonlens import ReasonLens

URL = os.getenv("REASONLENS_URL", "https://reasonlens.vercel.app")
KEY = os.environ["REASONLENS_INGEST_KEY"]
rl = ReasonLens(URL, KEY, ingest=True, timeout=15)

with rl.trace("Is the premium support SLA 99.9%, and is the customer eligible for the enterprise tier?", "rag") as trace:
    trace.retrieval(
        "premium support SLA enterprise tier",
        [
            {"id":"sla-policy","title":"Support SLA policy","content":"Premium support targets 99.9% monthly availability.","metadata":{"source":"policy-a","score":0.97}},
            {"id":"sla-contract","title":"Enterprise contract","content":"The current contract guarantees 99.5% monthly availability.","metadata":{"source":"contract-b","score":0.94}},
        ],
        retriever="provenance-edge-case", top_k=2,
    )
    supported=trace.claim("Premium support targets 99.9% monthly availability.",["sla-policy"],confidence=0.96)
    contradicted=trace.claim("The customer contract guarantees 99.9% monthly availability.",["sla-policy"],confidence=0.91)
    trace.edge("sla-contract",contradicted,"contradicts")
    unsupported=trace.claim("The customer is automatically eligible for the enterprise tier.",[],confidence=0.88)
    decision=trace.decision("Do not infer enterprise eligibility from the SLA evidence alone.",confidence=0.95)
    trace.edge(supported,decision,"supports")
    trace.edge(contradicted,decision,"supports")
    trace.edge(unsupported,decision,"depends_on")
    trace.answer("Premium support has conflicting SLA evidence, and the supplied evidence does not establish automatic enterprise-tier eligibility.")

print("PROVENANCE EDGE CASES: completed")
print("Open the newest trace and inspect Answer Provenance.")
