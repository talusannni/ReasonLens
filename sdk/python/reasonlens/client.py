from __future__ import annotations
import time, uuid
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
    created_at: str = field(default_factory=lambda: __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat())
    nodes: list[dict[str, Any]] = field(default_factory=list)
    edges: list[dict[str, Any]] = field(default_factory=list)
    started: float = field(default_factory=time.perf_counter)
    answer_text: str = ""
    status: str = "running"
    _last_node_id: str | None = field(default=None, init=False, repr=False)

    def __post_init__(self):
        self.nodes.append({"id":"prompt","kind":"prompt","label":"User prompt","detail":self.prompt,"metadata":{}})
        self._last_node_id = "prompt"

    def __enter__(self): return self

    def __exit__(self, exc_type, exc_value, traceback):
        if exc_type is None: self.finish()
        else:
            self.node("warning", "Unhandled exception", str(exc_value or exc_type))
            self.finish("failed")
        return False

    def node(self, kind:str, label:str, detail:str="", metadata:dict[str,Any]|None=None, node_id:str|None=None)->str:
        nid=node_id or str(uuid.uuid4())
        self.nodes.append({"id":nid,"kind":kind,"label":label,"detail":detail,"metadata":metadata or {}})
        if self._last_node_id and self._last_node_id != nid:
            self.edge(self._last_node_id, nid, "depends_on")
        self._last_node_id = nid
        return nid

    def edge(self, source:str, target:str, kind:str="depends_on", edge_id:str|None=None)->str:
        for existing in self.edges:
            if existing["source"] == source and existing["target"] == target and existing["kind"] == kind:
                return existing["id"]
        eid=edge_id or str(uuid.uuid4())
        self.edges.append({"id":eid,"source":source,"target":target,"kind":kind})
        return eid

    def llm(self, model:str, input_text:str, output_text:str, input_tokens:int=0, output_tokens:int=0, provider:str="groq")->str:
        self.model=model; self.provider=provider
        return self.node("model",f"LLM · {model}",output_text,{"inputTokens":input_tokens,"outputTokens":output_tokens,"inputChars":len(input_text),"outputChars":len(output_text)})

    def retrieval(self, query:str, documents:list[dict[str,Any]])->str:
        nid=self.node("retrieval","Retrieval",query,{"documentCount":len(documents)})
        for doc in documents:
            did=self.node("evidence",str(doc.get("title") or doc.get("id") or "Evidence"),str(doc.get("content") or ""),doc.get("metadata") or {})
            self.edge(nid,did,"retrieves")
        return nid

    def tool(self,name:str,input_data:Any,output_data:Any,success:bool=True)->str:
        return self.node("tool",f"Tool · {name}",str(output_data),{"success":success,"input":str(input_data)})

    def claim(self,text:str,supported_by:list[str]|None=None)->str:
        nid=self.node("claim","Claim",text)
        for source in supported_by or []: self.edge(source,nid,"supports")
        return nid

    def decision(self,text:str)->str: return self.node("decision","Decision",text)

    def answer(self,text:str)->str:
        self.answer_text=text
        return self.node("answer","Final answer",text)

    def finish(self,status:str="completed")->dict[str,Any]:
        self.status=status
        latency_ms=int((time.perf_counter()-self.started)*1000)
        total_in=sum(int(n.get("metadata",{}).get("inputTokens",0)) for n in self.nodes)
        total_out=sum(int(n.get("metadata",{}).get("outputTokens",0)) for n in self.nodes)
        trace={"id":self.id,"createdAt":self.created_at,"provider":self.provider,"model":self.model,"prompt":self.prompt,"mode":self.mode,"nodes":self.nodes,"edges":self.edges,"answer":self.answer_text,"status":status,"metrics":{"latencyMs":latency_ms,"inputTokens":total_in,"outputTokens":total_out,"estimatedCostUsd":estimate_groq_cost(self.model, total_in, total_out) if self.provider == "groq" else 0.0}}
        if self.client.ingest: self.client.send(trace)
        return trace

class ReasonLens:
    def __init__(self, base_url:str, api_key:str|None=None, ingest:bool=True, timeout:float=10):
        self.base_url=base_url.rstrip("/")
        self.api_key=api_key
        self.ingest=ingest
        self.timeout=timeout

    def trace(self,prompt:str,mode:str="chat")->TraceContext: return TraceContext(self,prompt,mode)

    def send(self,trace:dict[str,Any])->None:
        headers={"Content-Type":"application/json"}
        if self.api_key: headers["Authorization"]=f"Bearer {self.api_key}"
        r=requests.post(self.base_url+"/api/traces",json=trace,headers=headers,timeout=self.timeout)
        r.raise_for_status()
