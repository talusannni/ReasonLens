import assert from 'node:assert/strict';
import {getTraceExecutionInfo} from '../lib/trace-execution';
import type {Trace} from '../lib/types';

function makeTrace(overrides:Partial<Trace>={}):Trace {
 return {
  id:'trace-1',createdAt:new Date(0).toISOString(),provider:'groq',model:'test-model',
  prompt:'test',mode:'rag',nodes:[],edges:[],answer:'',status:'completed',
  metrics:{latencyMs:1,inputTokens:0,outputTokens:0,estimatedCostUsd:0},
  ...overrides,
 };
}
const retrieval=makeTrace({nodes:[
 {id:'r',kind:'retrieval',label:'Retrieve',metadata:{topK:2}},
 {id:'c',kind:'analysis',label:'Context',metadata:{replayMode:'retrieval-only',llmCalls:0}},
]});
assert.equal(getTraceExecutionInfo(retrieval).kind,'retrieval-only');
assert.equal(getTraceExecutionInfo(retrieval).llmCalled,false);

const full=makeTrace({nodes:[
 {id:'r',kind:'retrieval',label:'Retrieve',metadata:{}},
 {id:'m',kind:'model',label:'LLM request',metadata:{inputMessages:[]}},
]});
assert.equal(getTraceExecutionInfo(full).kind,'full-pipeline');
assert.equal(getTraceExecutionInfo(full).llmCalled,true);

const chat=makeTrace({mode:'chat',nodes:[
 {id:'m',kind:'model',label:'LLM request',metadata:{}},
]});
assert.equal(getTraceExecutionInfo(chat).kind,'llm-executed');

const failed=makeTrace({status:'failed',nodes:[{id:'w',kind:'warning',label:'Error',metadata:{}}]});
assert.equal(getTraceExecutionInfo(failed).kind,'partial');

const unknown=makeTrace();
assert.equal(getTraceExecutionInfo(unknown).llmCalled,'unknown');
console.log('Trace execution classification tests passed.');
