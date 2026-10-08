import assert from 'node:assert/strict';
import {compareEvaluationRuns,evaluateDataset,type EvaluationCase} from '../lib/evaluation';
import type {Trace} from '../lib/types';

const trace=(id:string,prompt:string,contradicted=false):Trace=>({
 id,createdAt:new Date().toISOString(),provider:'mock',model:'test',prompt,mode:'rag',answer:'Evidence-backed answer.',status:'completed',
 metrics:{latencyMs:100,inputTokens:10,outputTokens:20,estimatedCostUsd:0.001},
 nodes:[{id:'e',kind:'evidence',label:'Policy',detail:'Relevant policy evidence.'},{id:'c',kind:'claim',label:'Claim',detail:'Evidence-backed claim.'},{id:'a',kind:'answer',label:'Answer',detail:'Evidence-backed answer.'}],
 edges:[{id:'s',source:'e',target:'c',kind:'supports'},{id:'ca',source:'c',target:'a',kind:'answers'}].concat(contradicted?[{id:'x',source:'e',target:'c',kind:'contradicts' as const}]:[])
});
const cases:EvaluationCase[]=[{id:'one',name:'One',prompt:'Question one'},{id:'two',name:'Two',prompt:'Question two'},{id:'three',name:'Three',prompt:'Question three'}];
const baseline=evaluateDataset('Baseline',cases,[trace('1','Question one'),trace('2','Question two')]);
assert.equal(baseline.evaluatedCases,2); assert.equal(baseline.missingCases,1); assert.equal(baseline.passedCases,2); assert.equal(baseline.passRate,66.7);
const current=evaluateDataset('Current',cases,[trace('1','Question one'),trace('2','Question two',true)]);
assert.equal(current.failedCases,1);
const comparison=compareEvaluationRuns(baseline,current);
assert.ok(comparison.regressions.some(r=>r.caseId==='two'));
assert.equal(comparison.passRateDelta,-33.4);
console.log('evaluation tests passed');
