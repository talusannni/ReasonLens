import assert from 'node:assert/strict';
import {compareEvidence, extractEvidence, getCapturedLlmInput, isRetrievalOnlyTrace} from '../lib/evidence-diff';
import type {Trace} from '../lib/types';

function trace(id:string, evidence:Array<{id:string;source:string;page:number;content:string;rank:number;score:number}>, options:{topK?:number;messages?:Array<Record<string,unknown>>;contextText?:string}={}):Trace{
 const nodes:Trace['nodes']=[
  {id:'prompt',kind:'prompt',label:'User prompt',detail:'Find policy evidence.'},
  {id:'retrieval-'+id,kind:'retrieval',label:'Retrieval',detail:'policy query',metadata:{retriever:'test-retriever',topK:options.topK??evidence.length}},
  ...evidence.map(item=>({id:item.id,kind:'evidence' as const,label:item.id,detail:item.content,metadata:{source:item.source,page:item.page,rank:item.rank,score:item.score}})),
 ];
 if(options.messages)nodes.push({id:'model-'+id,kind:'model',label:'LLM',detail:'answer',metadata:{inputMessages:options.messages}});
 if(options.contextText)nodes.push({id:'context-'+id,kind:'analysis',label:'LLM context assembly',detail:'assembled',metadata:{contextText:options.contextText}});
 const retrievalId='retrieval-'+id;
 const edges:Trace['edges']=evidence.map(item=>({id:'edge-'+id+'-'+item.id,source:retrievalId,target:item.id,kind:'retrieves'}));
 return {id,createdAt:'2026-01-01T00:00:00Z',provider:'mock',model:'test-model',prompt:'Find policy evidence.',mode:'rag',nodes,edges,answer:'answer',status:'completed',metrics:{latencyMs:10,inputTokens:1,outputTokens:2,estimatedCostUsd:0}};
}
const baseline=trace('a',[
 {id:'a-page1',source:'policy.pdf',page:1,content:'Refunds within 30 days.',rank:1,score:.95},
 {id:'b-page1',source:'shipping.pdf',page:1,content:'Shipping takes three days.',rank:2,score:.4},
],{topK:2});
const current=trace('b',[
 {id:'different-id-page1',source:'policy.pdf',page:1,content:'Refunds within 14 days.',rank:2,score:.7},
 {id:'c-page1',source:'contract.pdf',page:1,content:'Contract supersedes general policy.',rank:1,score:.91},
],{topK:2});
const diff=compareEvidence(baseline,current);
assert.equal(diff.baselineCount,2);
assert.equal(diff.currentCount,2);
assert.equal(diff.added,1);
assert.equal(diff.removed,1);
assert.equal(diff.changed,1);
assert.equal(diff.items.find(item=>item.kind==='changed')?.changes.includes('content'),true);
assert.equal(extractEvidence(baseline).length,2);
assert.equal(diff.queryA,'policy query');
assert.equal(diff.retrieverB,'test-retriever');

const messages=[{role:'user',content:'Question and context'}];
assert.equal(getCapturedLlmInput(trace('with-input',[],{messages})),JSON.stringify(messages,null,2));
assert.match(getCapturedLlmInput(trace('retrieval-only',[],{contextText:'[doc-1] policy text'}))||'',/No LLM call was made/);
assert.equal(getCapturedLlmInput(trace('no-input',[])),null);
assert.equal(isRetrievalOnlyTrace(trace('retrieval-only',[],{contextText:'prepared context'})),true);
assert.equal(isRetrievalOnlyTrace(trace('full-run',[],{messages})),false);
console.log('evidence diff tests passed');
