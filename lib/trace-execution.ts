import type {Trace} from './types';

export type TraceExecutionKind =
  | 'retrieval-only'
  | 'full-pipeline'
  | 'llm-executed'
  | 'partial'
  | 'no-llm';

export interface TraceExecutionInfo {
  kind: TraceExecutionKind;
  label: string;
  detail: string;
  llmCalled: boolean | 'unknown';
}

export function getTraceExecutionInfo(trace: Trace): TraceExecutionInfo {
  const nodes = trace.nodes ?? [];
  const modelNode = nodes.find((node) => node.kind === 'model');
  const retrievalOnly = nodes.some((node) =>
    node.metadata?.replayMode === 'retrieval-only' ||
    (node.label === 'Retrieval-only replay complete' && node.metadata?.llmCalls === 0)
  );
  const llmCalls = modelNode ? 1 : 0;
  const explicitLlmCalls = nodes.find((node) => typeof node.metadata?.llmCalls === 'number')?.metadata?.llmCalls;
  const llmCalled: boolean | 'unknown' = modelNode ? true :
    explicitLlmCalls === 0 || retrievalOnly ? false : 'unknown';

  if (trace.status === 'failed' || trace.status === 'running') {
    return {
      kind: 'partial',
      label: trace.status === 'failed' ? 'Failed / partial' : 'In progress',
      detail: modelNode ? 'Execution did not complete; an LLM request is present in this trace.' :
        retrievalOnly ? 'Execution stopped in retrieval-only mode; no LLM request is present.' :
        'Execution did not complete. Inspect the graph to see which stages ran.',
      llmCalled,
    };
  }
  if (retrievalOnly) {
    return {
      kind: 'retrieval-only',
      label: 'Retrieval only · no LLM call',
      detail: 'Retrieval and context preparation were recorded; answer generation was intentionally skipped.',
      llmCalled: false,
    };
  }
  if (modelNode && (nodes.some((node) => node.kind === 'retrieval') || nodes.some((node) => node.kind === 'tool'))) {
    return {
      kind: 'full-pipeline',
      label: 'Pipeline · LLM executed',
      detail: 'This trace includes an LLM request and at least one retrieval or tool stage.',
      llmCalled: true,
    };
  }
  if (modelNode) {
    return {
      kind: 'llm-executed',
      label: 'LLM executed',
      detail: 'An LLM request is captured in this trace.',
      llmCalled: true,
    };
  }
  if (trace.provider === 'mock') {
    return {
      kind: 'no-llm',
      label: 'Demo trace · no captured LLM call',
      detail: 'This trace was created by the demo engine and does not contain a captured model request.',
      llmCalled: false,
    };
  }
  return {
    kind: 'no-llm',
    label: 'No LLM request captured',
    detail: 'No model node was found. This does not prove that an external model was never called; verify instrumentation coverage.',
    llmCalled,
  };
}
