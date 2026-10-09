import assert from 'node:assert/strict';
import {evaluateDataset,type EvaluationCase,type EvaluationRun} from '../lib/evaluation';
import {evaluateEvaluationRegression} from '../lib/evaluation-regression';
import type {GraphEdge,Trace} from '../lib/types';

function trace(id:string,prompt:string,opts:{contradicted?:boolean;latencyMs?:number;cost?:number}={}):Trace {
  const nodes:Trace['nodes']=[
    {id:'e',kind:'evidence',label:'Policy',detail:'Premium support is 99.9%.'},
    {id:'c',kind:'claim',label:'Claim',detail:'Premium support availability is 99.9%.'},
    {id:'a',kind:'answer',label:'Answer',detail:'Premium support availability is 99.9%.'}
  ];
  const edges:GraphEdge[]=[{id:'s',source:'e',target:'c',kind:'supports'},{id:'a',source:'c',target:'a',kind:'answers'}];
  if(opts.contradicted){nodes.push({id:'e2',kind:'evidence',label:'Contract',detail:'Contract states 99.5%.'});edges.push({id:'x',source:'e2',target:'c',kind:'contradicts'});}
  return {id,createdAt:new Date().toISOString(),provider:'mock',model:'test',prompt,mode:'rag',nodes,edges,answer:'Premium support availability is 99.9%.',status:'completed',metrics:{latencyMs:opts.latencyMs??100,inputTokens:10,outputTokens:20,estimatedCostUsd:opts.cost??0.001}};
}
const cases:EvaluationCase[]=[{id:'sla',name:'SLA',prompt:'Is support 99.9%?'}];
function run(name:string,t:Trace[]):EvaluationRun{return evaluateDataset(name,cases,t);}
const baseline=run('baseline',[trace('base','Is support 99.9%?',{latencyMs:100,cost:0.001})]);
const healthy=run('healthy',[trace('current','Is support 99.9%?',{latencyMs:110,cost:0.0011})]);
const healthyReport=evaluateEvaluationRegression(baseline,healthy);
assert.equal(healthyReport.status,'PASS');
assert.equal(healthyReport.caseRegressions.length,0);

const degraded=run('degraded',[trace('bad','Is support 99.9%?',{contradicted:true,latencyMs:200,cost:0.002})]);
const degradedReport=evaluateEvaluationRegression(baseline,degraded);
assert.equal(degradedReport.status,'FAIL');
assert.ok(degradedReport.rules.some(r=>r.id==='case-regressions'&&r.status==='FAIL'));
assert.ok(degradedReport.rules.some(r=>r.id==='latency'&&r.status==='WARN'));
assert.ok(degradedReport.rules.some(r=>r.id==='cost'&&r.status==='WARN'));

const missing=run('missing',[]);
const missingReport=evaluateEvaluationRegression(baseline,missing);
assert.equal(missingReport.status,'FAIL');
assert.ok(missingReport.rules.some(r=>r.id==='missing-cases'&&r.status==='FAIL'));
console.log('evaluation regression gate tests passed');
