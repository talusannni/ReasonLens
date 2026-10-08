import { buildScenarioTrace } from './scenarios';
import type { Trace, TraceMode } from './types';
import { estimateGroqCost } from './pricing';

export async function runTrace(
  prompt: string,
  provider = process.env.REASONLENS_PROVIDER || 'mock',
  model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
  mode: TraceMode = 'chat'
): Promise<Trace> {
  if (provider === 'mock') return buildScenarioTrace(prompt, mode);
  if (provider !== 'groq') throw new Error('Unsupported provider. ReasonLens supports Groq and the local demo engine.');

  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY is required for the Groq provider.');

  const started = Date.now();
  const system = 'You are an AI observability trace generator. Never reveal private chain-of-thought. Return JSON only with keys answer,nodes,edges. Represent concise externally explainable steps, retrieved evidence, tool calls, claims and decisions. nodes:{id,kind,label,detail,metadata}; kind:prompt,analysis,retrieval,evidence,claim,decision,tool,model,answer,warning. edges:{id,source,target,kind}; kind:supports,contradicts,depends_on,produces,retrieves,calls,answers.';

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    })
  });

  if (!res.ok) throw new Error('Groq returned ' + res.status + ': ' + await res.text());

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Groq returned no content.');

  const parsed = JSON.parse(content);
  const promptNode = { id: 'prompt', kind: 'prompt' as const, label: 'User prompt', detail: prompt };
  const latencyMs = Date.now() - started;
  const usage = data.usage || {};
  const modelNode = {
    id: 'model-call',
    kind: 'model' as const,
    label: 'LLM · ' + model,
    detail: String(parsed.answer || ''),
    metadata: {
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      latencyMs,
      finishReason: data.choices?.[0]?.finish_reason || 'unknown',
      provider: 'groq'
    }
  };
  const answerNode = { id: 'answer', kind: 'answer' as const, label: 'Final answer', detail: String(parsed.answer || '') };
  const nodes = (Array.isArray(parsed.nodes) ? parsed.nodes : [])
    .filter((n: any) => n?.id && n?.kind && n?.label && n.id !== 'prompt' && n.id !== 'answer' && n.id !== 'model-call')
    .concat([promptNode, modelNode, answerNode]);
  const edges = (Array.isArray(parsed.edges) ? parsed.edges : [])
    .filter((e: any) => e?.source && e?.target && e?.kind);

  if (!edges.some((e: any) => e.source === 'model-call' && e.target === 'answer')) {
    edges.push({ id: 'model-answer', source: 'model-call', target: 'answer', kind: 'answers' });
  }
  if (!edges.some((e: any) => e.source === 'prompt' && e.target === 'model-call')) {
    edges.push({ id: 'prompt-model', source: 'prompt', target: 'model-call', kind: 'depends_on' });
  }
  if (!edges.some((e: any) => e.target === 'answer')) {
    edges.push({
      id: 'final',
      source: nodes.find((n: any) => n.id !== 'answer')?.id || 'prompt',
      target: 'answer',
      kind: 'answers'
    });
  }

  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    provider: 'groq',
    model,
    prompt,
    mode,
    nodes,
    edges,
    answer: answerNode.detail || '',
    status: 'completed',
    metrics: {
      latencyMs,
      inputTokens: usage.prompt_tokens || 0,
      outputTokens: usage.completion_tokens || 0,
      estimatedCostUsd: estimateGroqCost(model, usage.prompt_tokens || 0, usage.completion_tokens || 0)
    }
  };
}
