import type { Trace } from './types';

const globalStore=globalThis as typeof globalThis & { __reasonlens_traces?:Map<string,Trace> };
const store=globalStore.__reasonlens_traces ??= new Map<string,Trace>();

export function saveTrace(trace:Trace):Trace{store.set(trace.id,trace);return trace;}
export function getTrace(id:string):Trace|undefined{return store.get(id);}
export function listTraces():Trace[]{return [...store.values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
