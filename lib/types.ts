export type NodeKind = 'prompt'|'analysis'|'retrieval'|'evidence'|'claim'|'decision'|'tool'|'model'|'answer'|'warning';
export type EdgeKind = 'supports'|'contradicts'|'depends_on'|'produces'|'retrieves'|'calls'|'answers';
export type TraceMode = 'chat'|'rag'|'agent';
export type TraceStatus = 'completed'|'failed'|'running';
export interface GraphNode { id:string; kind:NodeKind; label:string; detail?:string; metadata?:Record<string,string|number|boolean>; }
export interface GraphEdge { id:string; source:string; target:string; kind:EdgeKind; }
export interface Trace { id:string; createdAt:string; provider:string; model:string; prompt:string; mode:TraceMode; nodes:GraphNode[]; edges:GraphEdge[]; answer:string; status:TraceStatus; metrics:{latencyMs:number; inputTokens:number; outputTokens:number; estimatedCostUsd:number}; }
