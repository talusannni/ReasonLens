import assert from 'node:assert/strict';
import {compareEvaluationRuns,evaluateDataset,matchTrace,type EvaluationCase} from '../lib/evaluation';
import type {GraphEdge,Trace,TraceMode} from '../lib/types';

const trace=(id:string,prompt:string,contradicted=false,mode:TraceMode='rag'):Trace=>{
 const nodes:Trace['nodes']=mode==='chat'
  ?[{id:'m',kind:'model',label:'LLM response'},{id:'c',kind:'claim',label:'Claim',detail:'Answer claim.'},{id:'a',kind:'answer',label:'Answer',detail:'Answer.'}]
  :[{id:'e',kind:'evidence',label:'Policy',detail:'Relevant policy evidence.'},{id:'c',kind:'claim',label:'Claim',detail:'Evidence-backed claim.'},{id:'a',kind:'answer',label:'Answer',detail:'Evidence-backed answer.'}];
 const edges:GraphEdge[]=mode==='chat'
  ?[{id:'mc',source:'m',target:'c',kind:'produces'},{id:'ca',source:'c',target:'a',kind:'answers'}]
  :[{id:'s',source:'e',target:'c',kind:'supports'},{id:'ca',source:'c',target:'a',kind:'answers'}];
 if(contradicted&&mode!=='chat')edges.push({id:'x',source:'e',target:'c',kind:'contradicts'});
 return {id,createdAt:new Date().toISOString(),provider:'mock',model:'test',prompt,mode,answer:'Evidence-backed answer.',status:'completed',metrics:{latencyMs:100,inputTokens:10,outputTokens:20,estimatedCostUsd:0.001},nodes,edges};
};
const cases:EvaluationCase[]=[{id:'one',name:'One',prompt:'Question one'},{id:'two',name:'Two',prompt:'Question two'},{id:'three',name:'Three',prompt:'Question three'}];
const duplicateA=trace('baseline-id','Question one');
const duplicateB=trace('degraded-id','Question one',true);
assert.equal(matchTrace({id:'pinned',name:'Pinned',prompt:'Question one',traceId:'baseline-id'},[duplicateB,duplicateA])?.id,'baseline-id');
const samePromptChat=trace('chat-prompt','Question same',false,'chat');
const samePromptRag=trace('rag-prompt','Question same',false,'rag');
assert.equal(matchTrace({id:'mode-filter',name:'Mode filter',prompt:'Question same',mode:'rag'},[samePromptChat,samePromptRag])?.id,'rag-prompt','evaluation cases must match the requested trace mode');
const baseline=evaluateDataset('Baseline',cases,[trace('1','Question one'),trace('2','Question two')]);
assert.equal(baseline.evaluatedCases,2); assert.equal(baseline.missingCases,1); assert.equal(baseline.passedCases,2); assert.equal(baseline.passRate,66.7);
assert.equal(baseline.provenanceEvaluatedCases,2);
const current=evaluateDataset('Current',cases,[trace('1','Question one'),trace('2','Question two',true)]);
assert.equal(current.failedCases,1);
const comparison=compareEvaluationRuns(baseline,current);
assert.ok(comparison.regressions.some(r=>r.caseId==='two'));
assert.equal(comparison.passRateDelta,-33.4);

const chatTrace=trace('chat-1','What is AI?',false,'chat');
const chatRun=evaluateDataset('Chat only',[{id:'chat-case',name:'What is AI?',prompt:'What is AI?'}],[chatTrace]);
assert.equal(chatRun.passedCases,1,'chat trace should not fail only because provenance evidence is absent');
assert.equal(chatRun.provenanceEvaluatedCases,0,'chat-only runs should not claim to have evaluated provenance');
assert.equal(chatRun.averageProvenanceScore,0,'non-applicable provenance is excluded from the average');
assert.ok(!chatRun.results[0].report?.rules.some(r=>r.id==='provenance-score'));
const retrievalOnly:Trace={...trace('retrieval-only','Question retrieval'),answer:'',nodes:[{id:'r',kind:'retrieval',label:'Retrieval',metadata:{replayMode:'retrieval-only',llmCalls:0}}],edges:[]};
const retrievalRun=evaluateDataset('Retrieval only',[{id:'retrieval-case',name:'Retrieval only',prompt:'Question retrieval'}],[retrievalOnly]);
assert.equal(retrievalRun.notEvaluatedCases,1,'retrieval-only traces must not be reported as answer-evaluation failures or passes');
assert.equal(retrievalRun.failedCases,0);
assert.equal(retrievalRun.passedCases,0);
assert.equal(retrievalRun.results[0].status,'not_evaluated');
console.log('evaluation tests passed');
