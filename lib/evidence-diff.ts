import type {GraphNode, Trace} from './types';

export type EvidenceChangeKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface EvidenceItem {
  key: string;
  id: string;
  title: string;
  content: string;
  source: string;
  rank: number | null;
  score: number | null;
}

export interface EvidenceDiffItem {
  kind: EvidenceChangeKind;
  key: string;
  before: EvidenceItem | null;
  after: EvidenceItem | null;
  changes: string[];
}

export interface EvidenceDiffReport {
  queryA: string;
  queryB: string;
  retrieverA: string;
  retrieverB: string;
  topKA: number | null;
  topKB: number | null;
  baselineCount: number;
  currentCount: number;
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  items: EvidenceDiffItem[];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function metadataLocation(metadata: Record<string, unknown>): string {
  return ['chunkId', 'documentId', 'page', 'paragraph', 'table', 'section', 'chunkIndex']
    .map((key) => {
      const value = metadata[key];
      return value === undefined || value === null ? '' : `${key}=${String(value)}`;
    })
    .filter(Boolean)
    .join('|');
}

function stableKey(node: GraphNode): string {
  const metadata = node.metadata ?? {};
  const source = text(metadata.source || metadata.file || metadata.url);
  const location = metadataLocation(metadata);
  if (source && location) return `${source.toLowerCase()}|${location.toLowerCase()}`;
  if (source) return `${source.toLowerCase()}|${node.label.toLowerCase()}`;
  const documentId = text(metadata.documentId || metadata.chunkId);
  if (documentId) return documentId.toLowerCase();
  return node.id;
}

export function extractEvidence(trace: Trace): EvidenceItem[] {
  const evidenceNodes = trace.nodes.filter((node) => node.kind === 'evidence');
  const retrievalNodes = trace.nodes.filter((node) => node.kind === 'retrieval');
  const retrievedIds = new Set<string>();
  for (const retrieval of retrievalNodes) {
    for (const edge of trace.edges) {
      if (edge.source === retrieval.id && edge.kind === 'retrieves') retrievedIds.add(edge.target);
    }
    const ids = retrieval.metadata?.evidenceIds;
    if (Array.isArray(ids)) ids.forEach((id) => { if (typeof id === 'string') retrievedIds.add(id); });
  }
  const selected = retrievedIds.size
    ? evidenceNodes.filter((node) => retrievedIds.has(node.id))
    : evidenceNodes;

  return selected.map((node, index) => {
    const metadata = node.metadata ?? {};
    return {
      key: stableKey(node),
      id: node.id,
      title: node.label || node.id,
      content: node.detail || '',
      source: text(metadata.source || metadata.file || metadata.url),
      rank: numeric(metadata.rank) ?? index + 1,
      score: numeric(metadata.score),
    };
  });
}

function compareItem(before: EvidenceItem, after: EvidenceItem): string[] {
  const changes: string[] = [];
  if (before.content.trim() !== after.content.trim()) changes.push('content');
  if (before.rank !== after.rank) changes.push('rank/order');
  if (before.score !== after.score) changes.push('retrieval score');
  if (before.source !== after.source) changes.push('source');
  return changes;
}

export function compareEvidence(baseline: Trace, current: Trace): EvidenceDiffReport {
  const a = extractEvidence(baseline);
  const b = extractEvidence(current);
  const mapA = new Map(a.map((item) => [item.key, item]));
  const mapB = new Map(b.map((item) => [item.key, item]));
  const keys = [...new Set([...a.map((item) => item.key), ...b.map((item) => item.key)])];
  const items: EvidenceDiffItem[] = keys.map((key) => {
    const before = mapA.get(key) ?? null;
    const after = mapB.get(key) ?? null;
    if (!before) return {kind: 'added', key, before: null, after, changes: ['new evidence']};
    if (!after) return {kind: 'removed', key, before, after: null, changes: ['evidence no longer retrieved']};
    const changes = compareItem(before, after);
    return {kind: changes.length ? 'changed' : 'unchanged', key, before, after, changes};
  });
  const retrievalA = baseline.nodes.find((node) => node.kind === 'retrieval');
  const retrievalB = current.nodes.find((node) => node.kind === 'retrieval');
  return {
    queryA: retrievalA?.detail || baseline.prompt,
    queryB: retrievalB?.detail || current.prompt,
    retrieverA: text(retrievalA?.metadata?.retriever) || 'unknown',
    retrieverB: text(retrievalB?.metadata?.retriever) || 'unknown',
    topKA: numeric(retrievalA?.metadata?.topK),
    topKB: numeric(retrievalB?.metadata?.topK),
    baselineCount: a.length,
    currentCount: b.length,
    added: items.filter((item) => item.kind === 'added').length,
    removed: items.filter((item) => item.kind === 'removed').length,
    changed: items.filter((item) => item.kind === 'changed').length,
    unchanged: items.filter((item) => item.kind === 'unchanged').length,
    items,
  };
}

export function getCapturedLlmInput(trace: Trace): string | null {
  const modelNode = trace.nodes.find((node) => node.kind === 'model');
  if (!modelNode) return null;
  const messages = modelNode.metadata?.inputMessages;
  if (Array.isArray(messages)) return JSON.stringify(messages, null, 2);
  const inputText = modelNode.metadata?.inputText;
  return typeof inputText === 'string' ? inputText : null;
}
