import assert from 'node:assert/strict';
import {evaluateComparison,evaluateTrace} from '../lib/quality-gates';
import type {GraphEdge,GraphNode,Trace,TraceMode} from '../lib/types';

function makeTrace(id:string,mode:TraceMode,nodes:GraphNode[],edges:GraphEdge[],overrides:Partial<Trace>={}):Trace{
 return {
  id,createdAt:new Date().toISOString(),provider:'mock',model:'test',prompt:'What is AI?',
  mode,nodes,edges,answer:'AI is a field of computer science.',status:'completed',
  metrics:{latencyMs:100,inputTokens:10,outputTokens:20,estimatedCostUsd:0.001},
  ...overrides
 };
}
const ragNodes:GraphNode[]=[
 {id:'e',kind:'evidence',label:'Reference',detail:'AI is a field of computer science.'},
 {id:'c',kind:'claim',label:'Definition',detail:'AI is a field of computer science.',metadata:{confidence:.95}},
 {id:'a',kind:'answer',label:'Answer',detail:'AI is a field of computer science.'}
];
const ragEdges:GraphEdge[]=[
 {id:'s',source:'e',target:'c',kind:'supports'},
 {id:'ca',source:'c',target:'a',kind:'answers'}
];
const good=makeTrace('good','rag',ragNodes,ragEdges);
const bad=makeTrace('bad','rag',[
 {id:'c',kind:'claim',label:'Definition',detail:'AI is a field of computer science.'},
 {id:'a',kind:'answer',label:'Answer',detail:'AI is a field of computer science.'}
],[{id:'ca',source:'c',target:'a',kind:'answers'}]);
assert.equal(evaluateTrace(good).status,'PASS');
const badReport=evaluateTrace(bad);
assert.equal(badReport.status,'FAIL');
assert.ok(badReport.failures>=2);
const comparison=evaluateComparison(good,bad);
assert.equal(comparison.status,'FAIL');
assert.ok(comparison.rules.some(r=>r.id==='provenance-drop'&&r.status==='WARN'));

const chat=makeTrace('chat','chat',[
 {id:'m',kind:'model',label:'LLM response'},
 {id:'c',kind:'claim',label:'Definition',detail:'AI is a field of computer science.'},
 {id:'a',kind:'answer',label:'Answer',detail:'AI is a field of computer science.'}
],[{id:'mc',source:'m',target:'c',kind:'produces'},{id:'ca',source:'c',target:'a',kind:'answers'}]);
const chatReport=evaluateTrace(chat);
assert.equal(chatReport.status,'PASS','a chat trace without retrieval evidence must not fail provenance gates');
assert.ok(!chatReport.rules.some(r=>['provenance-score','answer-provenance','unsupported-claims'].includes(r.id)));
assert.ok(!chatReport.rules.some(r=>['provenance-score','answer-provenance','unsupported-claims','provenance-applicability'].includes(r.id)));
const chatWithEvidenceNode=makeTrace('chat-evidence-shaped','chat',[
 {id:'e',kind:'evidence',label:'Context-like node'},
 {id:'m',kind:'model',label:'LLM response'},
 {id:'c',kind:'claim',label:'Claim',detail:'Chat claim'},
 {id:'a',kind:'answer',label:'Answer',detail:'Chat answer'}
],[{id:'mc',source:'m',target:'c',kind:'produces'},{id:'ca',source:'c',target:'a',kind:'answers'}]);
const chatWithEvidenceReport=evaluateTrace(chatWithEvidenceNode);
assert.equal(chatWithEvidenceReport.status,'PASS','declared chat mode must remain non-provenance-evaluable even if an evidence-shaped node exists');
assert.ok(!chatWithEvidenceReport.rules.some(r=>r.id==='provenance-score'||r.id==='answer-provenance'));

const chatContradicted=makeTrace('chat-contradicted','chat',[
 {id:'c',kind:'claim',label:'Claim',detail:'The claim'},
 {id:'x',kind:'claim',label:'Contradiction',detail:'Contradictory claim'},
 {id:'a',kind:'answer',label:'Answer',detail:'The claim'}
],[{id:'x1',source:'x',target:'c',kind:'contradicts'},{id:'ca',source:'c',target:'a',kind:'answers'}]);
assert.equal(evaluateTrace(chatContradicted).status,'FAIL','explicit contradictions must still be checked for chat traces');

const agent=makeTrace('agent','agent',[
 {id:'plan',kind:'analysis',label:'Plan'},
 {id:'tool',kind:'tool',label:'Search result'},
 {id:'decision',kind:'decision',label:'Decision'},
 {id:'a',kind:'answer',label:'Answer',detail:'AI is a field of computer science.'}
],[{id:'p-t',source:'plan',target:'tool',kind:'calls'},{id:'t-d',source:'tool',target:'decision',kind:'produces'},{id:'d-a',source:'decision',target:'a',kind:'answers'}]);
const agentReport=evaluateTrace(agent);
assert.equal(agentReport.status,'PASS','a complete agent execution path without evidence links should not fail provenance');
assert.ok(agentReport.rules.some(r=>r.id==='agent-execution-path'&&r.status==='PASS'));
assert.ok(!agentReport.rules.some(r=>r.id==='provenance-score'));

const brokenAgent=makeTrace('broken-agent','agent',[
 {id:'tool',kind:'tool',label:'Unrelated tool'},
 {id:'a',kind:'answer',label:'Answer',detail:'AI is a field of computer science.'}
],[]);
assert.equal(evaluateTrace(brokenAgent).status,'FAIL','agent answer must connect to a recorded tool or decision');

const agentToolSupported=makeTrace('agent-supported','agent',[
 {id:'tool',kind:'tool',label:'Policy lookup result'},
 {id:'c',kind:'claim',label:'Claim',detail:'The policy says X.',metadata:{confidence:.95}},
 {id:'d',kind:'decision',label:'Decision'},
 {id:'a',kind:'answer',label:'Answer',detail:'The policy says X.'}
],[{id:'ts',source:'tool',target:'c',kind:'supports'},{id:'ca',source:'c',target:'a',kind:'answers'},{id:'da',source:'d',target:'a',kind:'answers'}]);
assert.equal(evaluateTrace(agentToolSupported).status,'PASS','explicit agent tool-to-claim support should be provenance-evaluable');

const failedChat=makeTrace('failed-chat','chat',[
 {id:'a',kind:'answer',label:'Answer',detail:'partial'}
],[],{status:'failed'});
assert.equal(evaluateTrace(failedChat).status,'FAIL','failed executions must fail in every mode');
const failedToolAgent=makeTrace('failed-tool-agent','agent',[
 {id:'tool',kind:'tool',label:'Search',metadata:{status:'error',error:'provider timeout'}},
 {id:'decision',kind:'decision',label:'Fallback decision'},
 {id:'a',kind:'answer',label:'Answer',detail:'Fallback answer.'}
],[{id:'t-d',source:'tool',target:'decision',kind:'produces'},{id:'d-a',source:'decision',target:'a',kind:'answers'}]);
const failedToolReport=evaluateTrace(failedToolAgent);
assert.equal(failedToolReport.status,'FAIL','explicitly failed agent tool calls must fail the trace evaluation');
assert.ok(failedToolReport.rules.some(r=>r.id==='agent-tool-outcomes'&&r.status==='FAIL'));
console.log('mode-aware quality gate tests passed');
