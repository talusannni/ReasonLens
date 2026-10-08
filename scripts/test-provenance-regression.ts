import assert from 'node:assert/strict';
import {compareProvenance} from '../lib/provenance-regression';
import type {Trace} from '../lib/types';

const base:Trace={id:'a',createdAt:'2026-01-01T00:00:00Z',provider:'test',model:'test',prompt:'q',mode:'rag',answer:'answer',status:'completed',metrics:{latencyMs:1,inputTokens:1,outputTokens:1,estimatedCostUsd:0},nodes:[
 {id:'p',kind:'prompt',label:'Prompt',detail:'q'},{id:'e1',kind:'evidence',label:'Policy',detail:'Policy says 99.9%'},{id:'c1',kind:'claim',label:'Claim',detail:'Premium support targets 99.9% monthly availability.',metadata:{confidence:.95}},{id:'a',kind:'answer',label:'Answer',detail:'answer'}],edges:[
 {id:'1',kind:'supports',source:'e1',target:'c1'},{id:'2',kind:'depends_on',source:'c1',target:'a'}]};
const degraded:Trace={...base,id:'b',nodes:[
 ...base.nodes.filter(n=>n.id!=='e1').map(n=>n.id==='c1'?{...n,metadata:{confidence:.95}}:n),
 {id:'e2',kind:'evidence',label:'Contradictory policy',detail:'Policy says 99.5%'}],edges:[
 {id:'1',kind:'contradicts',source:'e2',target:'c1'},{id:'2',kind:'depends_on',source:'c1',target:'a'}]};
const improved:Trace={...base,id:'c',nodes:[...base.nodes,{id:'e2',kind:'evidence',label:'Contract',detail:'Contract confirms 99.9%'}],edges:[...base.edges,{id:'3',kind:'supports',source:'e2',target:'c1'}]};
const r1=compareProvenance(base,degraded);
assert.equal(r1.regressions.length,1);
assert.equal(r1.regressions[0].statusA,'supported');
assert.equal(r1.regressions[0].statusB,'contradicted');
assert.ok(r1.scoreDelta<0);
const r2=compareProvenance(base,improved);
assert.equal(r2.improvements.length,1);
assert.equal(r2.evidenceAdded,1);
assert.ok(r2.scoreDelta>=0);
console.log('provenance regression tests passed');
