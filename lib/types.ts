export type NodeKind = 'prompt'|'analysis'|'retrieval'|'evidence'|'claim'|'decision'|'tool'|'model'|'answer'|'warning';
export type EdgeKind = 'supports'|'contradicts'|'depends_on'|'produces'|'retrieves'|'calls'|'answers';
export type TraceMode = 'chat'|'rag'|'agent';
export type TraceStatus = 'completed'|'failed'|'running';
export interface GraphNode { id:string; kind:NodeKind; label:string; detail?:string; metadata?:Record<string,unknown>; }
export interface GraphEdge { id:string; source:string; target:string; kind:EdgeKind; }
export interface TraceLineage { workflowId:string; parentTraceId?:string; experimentId?:string; configFingerprint?:string; }
export interface Trace { id:string; createdAt:string; provider:string; model:string; prompt:string; mode:TraceMode; nodes:GraphNode[]; edges:GraphEdge[]; answer:string; status:TraceStatus; lineage?:TraceLineage; metrics:{latencyMs:number; inputTokens:number; outputTokens:number; estimatedCostUsd:number}; }
