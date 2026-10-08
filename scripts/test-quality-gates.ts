import assert from 'node:assert/strict';
import {evaluateComparison,evaluateTrace} from '../lib/quality-gates';
import type {GraphEdge,GraphNode,Trace} from '../lib/types';

const base=(id:string,scoreClaim:string,status:'supported'|'contradicted'):Trace=>{
 const nodes:GraphNode[]=[
  {id:'e',kind:'evidence',label:'SLA policy',detail:scoreClaim},
  {id:'c',kind:'claim',label:'Availability claim',detail:'Premium support targets 99.9% monthly availability.'},
  {id:'a',kind:'answer',label:'Answer',detail:'Premium support availability is 99.9%.'}
 ];
 const edges:GraphEdge[]=[
  {id:'s',source:'e',target:'c',kind:'supports'},
  {id:'ca',source:'c',target:'a',kind:'answers'}
 ];
 if(status==='contradicted'){
  nodes.push({id:'e2',kind:'evidence',label:'Contract',detail:'Contract availability is 99.5%.'});
  edges.push({id:'x',source:'e2',target:'c',kind:'contradicts'},{id:'e2s',source:'e2',target:'c',kind:'supports'});
 }
 return {
  id,createdAt:new Date().toISOString(),provider:'mock',model:'test',prompt:'Is premium support 99.9%?',mode:'rag',
  answer:'Premium support availability is 99.9%.',status:'completed',
  metrics:{latencyMs:100,inputTokens:10,outputTokens:20,estimatedCostUsd:0.001},
  nodes,edges
 };
};

const good=base('good','Premium support targets 99.9%.','supported');
const bad=base('bad','Contract states 99.5%.','contradicted');

assert.equal(evaluateTrace(good).status,'PASS');
const badReport=evaluateTrace(bad);
assert.equal(badReport.status,'FAIL');
assert.ok(badReport.failures>=2);
const comparison=evaluateComparison(good,bad);
assert.equal(comparison.status,'FAIL');
assert.ok(comparison.rules.some(r=>r.id==='provenance-drop'&&r.status==='WARN'));
console.log('quality gate tests passed');
