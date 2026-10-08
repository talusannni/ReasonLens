"""Create a baseline RAG trace and a deliberately degraded follow-up trace."""
import os
from reasonlens import ReasonLens

URL=os.getenv("REASONLENS_URL","https://reasonlens.vercel.app")
KEY=os.environ["REASONLENS_INGEST_KEY"]
rl=ReasonLens(URL,KEY,ingest=True,timeout=15)
question="Is premium support availability 99.9% monthly?"

def run_baseline():
    with rl.trace(question,"rag") as trace:
        trace.retrieval("premium support availability",[
            {"id":"sla-policy","title":"Support SLA policy","content":"Premium support targets 99.9% monthly availability.","metadata":{"source":"policy-a","score":0.98}}
        ],retriever="regression-demo",top_k=1)
        claim=trace.claim("Premium support targets 99.9% monthly availability.",["sla-policy"],confidence=0.97)
        trace.answer("Yes. Premium support targets 99.9% monthly availability.")
    return trace

def run_degraded():
    with rl.trace(question,"rag") as trace:
        trace.retrieval("premium support availability",[
            {"id":"sla-policy","title":"Support SLA policy","content":"Premium support targets 99.9% monthly availability.","metadata":{"source":"policy-a","score":0.98}},
            {"id":"sla-contract","title":"Customer contract","content":"The current contract guarantees 99.5% monthly availability.","metadata":{"source":"contract-b","score":0.96}}
        ],retriever="regression-demo",top_k=2)
        claim=trace.claim("Premium support targets 99.9% monthly availability.",["sla-policy"],confidence=0.97)
        trace.edge("sla-contract",claim,"contradicts")
        trace.answer("The evidence conflicts. The customer contract states 99.5% monthly availability.")
    return trace

run_baseline()
run_degraded()
print("PROVENANCE REGRESSION DEMO: created baseline and degraded traces")
print("In ReasonLens: Trace history -> select the two newest traces -> Compare.")
