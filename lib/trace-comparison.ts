import type {Trace,TraceMode} from './types';

export type TraceComparisonCompatibility =
 | {compatible:true; mode:TraceMode; crossMode:false}
 | {compatible:false; modes:TraceMode[]; reason:string};

export function getTraceComparisonCompatibility(traces:Trace[]):TraceComparisonCompatibility{
 const modes=Array.from(new Set(traces.map(trace=>trace.mode)));
 if(modes.length<=1){
  return {compatible:true,mode:modes[0]??'rag',crossMode:false};
 }
 return {
  compatible:false,
  modes,
  reason:'Standard trace comparisons require the same mode. Select only chat, RAG, or agent traces. Cross-mode comparisons belong in an explicit experiment.'
 };
}

export function canAddTraceToComparison(selected:Trace[],candidate:Trace):boolean{
 if(selected.some(trace=>trace.id===candidate.id))return true;
 return selected.length===0||selected.every(trace=>trace.mode===candidate.mode);
}

export function filterComparableTraces<T extends Trace>(selected:Trace[],candidates:T[]):T[]{
 if(selected.length===0)return candidates;
 const mode=selected[0].mode;
 return candidates.filter(trace=>trace.mode===mode||selected.some(item=>item.id===trace.id));
}
