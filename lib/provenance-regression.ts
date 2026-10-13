import type {Trace} from './types';
import {analyzeProvenance,isProvenanceApplicable,type ClaimProvenance} from './provenance';
import {isRetrievalOnlyTrace} from './evidence-diff';

export type ProvenanceDiffKind='regression'|'improvement'|'changed'|'unchanged';
export interface ProvenanceClaimDiff {
  key:string; claimA?:string; claimB?:string;
  statusA?:ClaimProvenance['status']; statusB?:ClaimProvenance['status'];
  addedEvidence:string[]; removedEvidence:string[];
  kind:ProvenanceDiffKind; reason:string;
}
export interface ProvenanceRegressionReport {
  scoreDelta:number; answerPathChanged:boolean; answerPathA:boolean; answerPathB:boolean;
  regressions:ProvenanceClaimDiff[]; improvements:ProvenanceClaimDiff[];
  changes:ProvenanceClaimDiff[]; unchanged:number;
  addedClaims:number; removedClaims:number; evidenceAdded:number; evidenceRemoved:number;
}
const statusRank:Record<ClaimProvenance['status'],number>={supported:3,weak:2,unsupported:1,contradicted:0};

/** Provenance deltas are meaningful only when both traces expose an applicable evidence contract. */
export function isProvenanceComparable(a:Trace,b:Trace):boolean {
 return !isRetrievalOnlyTrace(a)&&!isRetrievalOnlyTrace(b)&&isProvenanceApplicable(a)&&isProvenanceApplicable(b);
}
function normalizeClaim(value:string):string{return value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');}
function diffClaim(a?:ClaimProvenance,b?:ClaimProvenance):ProvenanceClaimDiff{
 const key=normalizeClaim(b?.claim||a?.claim||'');
 const addedEvidence=b?.evidence.filter(id=>!a?.evidence.includes(id))||[];
 const removedEvidence=a?.evidence.filter(id=>!b?.evidence.includes(id))||[];
 if(!a&&b){const kind=b.status==='supported'||b.status==='weak'?'improvement':'regression';return {key,claimB:b.claim,statusB:b.status,addedEvidence,removedEvidence,kind,reason:kind==='improvement'?'New evidence-backed claim':'New claim lacks reliable support'};}
 if(a&&!b){const kind=a.status==='supported'||a.status==='weak'?'regression':'improvement';return {key,claimA:a.claim,statusA:a.status,addedEvidence,removedEvidence,kind,reason:kind==='regression'?'Evidence-backed claim disappeared':'Previously weak or unsupported claim disappeared'};}
 const before=statusRank[a!.status],after=statusRank[b!.status];
 let kind:ProvenanceDiffKind='unchanged',reason='No provenance change';
 if(after<before){kind='regression';reason=`Claim status worsened: ${a!.status} → ${b!.status}`;}
 else if(after>before){kind='improvement';reason=`Claim status improved: ${a!.status} → ${b!.status}`;}
 else if(addedEvidence.length||removedEvidence.length){kind=addedEvidence.length&&!removedEvidence.length?'improvement':removedEvidence.length&&!addedEvidence.length?'regression':'changed';reason=kind==='improvement'?'Supporting evidence was added':kind==='regression'?'Supporting evidence was removed':'Supporting evidence changed';}
 if(a!.contradictions.length!==b!.contradictions.length){
  if(b!.contradictions.length>a!.contradictions.length){kind='regression';reason='A contradiction was introduced';}
  else if(kind==='unchanged'||kind==='changed'){kind='improvement';reason='A contradiction was removed';}
 }
 return {key,claimA:a!.claim,claimB:b!.claim,statusA:a!.status,statusB:b!.status,addedEvidence,removedEvidence,kind,reason};
}
export function compareProvenance(a:Trace,b:Trace):ProvenanceRegressionReport{
 const pa=analyzeProvenance(a),pb=analyzeProvenance(b);
 const byKeyA=new Map(pa.claims.map(c=>[normalizeClaim(c.claim),c]));
 const byKeyB=new Map(pb.claims.map(c=>[normalizeClaim(c.claim),c]));
 const diffs:ProvenanceClaimDiff[]=[];
 for(const key of new Set([...byKeyA.keys(),...byKeyB.keys()]))diffs.push(diffClaim(byKeyA.get(key),byKeyB.get(key)));
 return {
  scoreDelta:pb.score-pa.score,answerPathChanged:pa.answerHasProvenance!==pb.answerHasProvenance,
  answerPathA:pa.answerHasProvenance,answerPathB:pb.answerHasProvenance,
  regressions:diffs.filter(d=>d.kind==='regression'),improvements:diffs.filter(d=>d.kind==='improvement'),
  changes:diffs.filter(d=>d.kind==='changed'),unchanged:diffs.filter(d=>d.kind==='unchanged').length,
  addedClaims:diffs.filter(d=>!d.claimA&&!!d.claimB).length,removedClaims:diffs.filter(d=>!!d.claimA&&!d.claimB).length,
  evidenceAdded:diffs.reduce((n,d)=>n+d.addedEvidence.length,0),evidenceRemoved:diffs.reduce((n,d)=>n+d.removedEvidence.length,0)
 };
}
