import assert from 'node:assert/strict';
import {canAddTraceToComparison,filterComparableTraces,getTraceComparisonCompatibility} from '../lib/trace-comparison';
import type {Trace,TraceMode} from '../lib/types';

function trace(id:string,mode:TraceMode):Trace{
 return {id,createdAt:'2026-01-01T00:00:00Z',provider:'test',model:'test',prompt:'test prompt',mode,answer:'test answer',status:'completed',metrics:{latencyMs:1,inputTokens:1,outputTokens:1,estimatedCostUsd:0},nodes:[],edges:[]};
}
const chatA=trace('chat-a','chat');
const chatB=trace('chat-b','chat');
const rag=trace('rag-a','rag');
const agent=trace('agent-a','agent');

assert.equal(getTraceComparisonCompatibility([]).compatible,true,'empty selection is valid');
assert.equal(getTraceComparisonCompatibility([chatA,chatB]).compatible,true,'same-mode chat comparison is valid');
assert.equal(getTraceComparisonCompatibility([rag,trace('rag-b','rag')]).compatible,true,'same-mode RAG comparison is valid');
assert.equal(getTraceComparisonCompatibility([agent,trace('agent-b','agent')]).compatible,true,'same-mode agent comparison is valid');
const mixed=getTraceComparisonCompatibility([chatA,rag]);
assert.equal(mixed.compatible,false,'cross-mode comparison is rejected by default');
if(!mixed.compatible)assert.match(mixed.reason,/same mode/i);
assert.equal(canAddTraceToComparison([chatA],chatB),true,'same-mode candidate can be selected');
assert.equal(canAddTraceToComparison([chatA],rag),false,'mixed-mode candidate cannot be selected');
assert.equal(canAddTraceToComparison([rag],agent),false,'agent candidate cannot be added to RAG selection');
assert.deepEqual(filterComparableTraces([chatA],[chatA,chatB,rag,agent]).map(item=>item.id),['chat-a','chat-b']);
assert.equal(filterComparableTraces([], [chatA,rag,agent]).length,3,'no selection leaves all modes available');
console.log('same-mode trace comparison tests passed');
