import assert from 'node:assert/strict';
import {analyzeExperiment,analyzeExperimentVariant,getExperimentBaseline} from '../lib/experiment-analysis';
import type {Trace} from '../lib/types';

function trace(overrides:Partial<Trace>={}):Trace {
 return {id:'00000000-0000-4000-8000-000000000001',createdAt:'2026-10-09T10:00:00.000Z',provider:'mock',model:'demo',prompt:'test prompt',mode:'rag',nodes:[{id:'e1',kind:'evidence',label:'Policy evidence'},{id:'c1',kind:'claim',label:'Supported claim',metadata:{confidence:0.95}},{id:'a1',kind:'answer',label:'Answer'}],edges:[{id:'x1',source:'e1',target:'c1',kind:'supports'},{id:'x2',source:'c1',target:'a1',kind:'answers'}],answer:'Answer',status:'completed',lineage:{workflowId:'workflow-1'},metrics:{latencyMs:100,inputTokens:10,outputTokens:10,estimatedCostUsd:0.001},...overrides};
}
const baseline=trace();
const slower=trace({id:'00000000-0000-4000-8000-000000000002',createdAt:'2026-10-09T10:01:00.000Z',lineage:{workflowId:'workflow-1',parentTraceId:baseline.id},metrics:{latencyMs:140,inputTokens:10,outputTokens:10,estimatedCostUsd:0.0015}});
const failed=trace({id:'00000000-0000-4000-8000-000000000003',createdAt:'2026-10-09T10:02:00.000Z',status:'failed',lineage:{workflowId:'workflow-1',parentTraceId:baseline.id},nodes:[],edges:[],answer:'',metrics:{latencyMs:80,inputTokens:0,outputTokens:0,estimatedCostUsd:0}});
assert.equal(getExperimentBaseline([slower,baseline])?.id,baseline.id);
const result=analyzeExperimentVariant(baseline,slower);
assert.equal(result.status,'WARN');
assert.equal(result.rules.find(r=>r.id==='latency')?.status,'WARN');
assert.equal(result.rules.find(r=>r.id==='cost')?.status,'WARN');
assert.equal(analyzeExperimentVariant(baseline,failed).status,'FAIL');
assert.equal(analyzeExperiment([baseline,slower]).variants.length,1);
console.log('Experiment analysis tests passed.');
