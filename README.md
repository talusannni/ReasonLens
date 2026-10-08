# ReasonLens

**See how AI reaches an answer.**

ReasonLens is a model-agnostic, local-first visual debugger for AI systems. It focuses on observable, externally explainable execution artifacts rather than private chain-of-thought.

## What works now

- Workspace with chat, RAG and agent trace modes
- Interactive execution graph
- Evidence and retrieval nodes for RAG workflows
- Tool-call nodes for agent workflows
- Claims, decisions and answer relationships
- Node inspector with metadata
- Trace metrics: latency and token counts
- Local browser trace history
- Search trace history
- Import/export trace JSON
- Zero-key demo engine
- Groq API provider
- Responsive desktop/mobile UI
- GitHub Actions typecheck/build validation

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000.

For the demo engine, no API key is required. For Groq configure:

```env
REASONLENS_PROVIDER=groq
REASONLENS_MODEL=<your-model>
GROQ_API_KEY=<your-key>
```


## Real application instrumentation

ReasonLens can ingest traces from an external AI application through `POST /api/traces`. Configure these server environment variables:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-key>
REASONLENS_INGEST_KEY=<private-ingestion-key>
```

The ingestion API stores traces in Supabase and rejects requests without the ingestion key.

### Python SDK

See `sdk/python`. It supports LLM, retrieval, tool, claim, decision and answer events and posts completed traces to ReasonLens.

### TypeScript SDK

See `sdk/typescript/reasonlens.ts`. It provides the same core instrumentation primitives without adding a runtime dependency.

Example:

```ts
import { ReasonLens } from './reasonlens';

const rl = new ReasonLens('https://reasonlens.vercel.app', process.env.REASONLENS_INGEST_KEY);
const trace = rl.trace('Answer a customer question', 'agent');
const evidence = trace.retrieval('refund policy', [{ title: 'Refund policy', content: 'Refunds are allowed within 30 days.' }]);
trace.tool('get_order', { id: '123' }, { status: 'delivered' });
trace.claim('Order is eligible for refund', [evidence]);
trace.decision('Approve refund');
trace.answer('The order is eligible for a refund.');
await trace.finish();
```

## Architecture

```text
User prompt
    |
    v
Trace API
    |
    +--> Provider adapter --> Structured trace
    |
    +--> Demo scenarios (chat / RAG / agent)
                              |
                              v
                     ReasonLens graph
                              |
              +---------------+---------------+
              |               |               |
           evidence        tools          decisions
              |               |               |
              +---------------+---------------+
                              |
                              v
                         Final answer
```

## Important boundary

ReasonLens does not attempt to expose hidden model chain-of-thought. It displays structured traces, evidence, tool execution, claims and decisions that can be intentionally produced and reviewed.

## Roadmap

- SDK for instrumenting applications
- OpenTelemetry trace ingestion
- Live streaming traces
- Real RAG connector ingestion
- Agent framework adapters
- Unsupported-claim and evidence-coverage evaluation
- Model comparison and regression evaluation
- Quality gates for provenance, contradictions, unsupported claims, latency and cost
- Persistent multi-user trace storage

## Quality gate checks

Run the deterministic quality-gate test suite:

```powershell
npm run test:quality-gates
```

The default gate policy fails runs below **80/100 provenance**, with disallowed contradictions or a missing answer provenance path. Unsupported claims, provenance drops, latency and estimated cost can produce warnings.

## License

Apache-2.0.


## Provenance regression demo

Create two real traces—a supported baseline and a deliberately degraded RAG run:

```powershell
$env:PYTHONPATH="sdk/python"
python sdk/python/examples/provenance_regression_demo.py
```

Then open **Trace history**, select the two newest traces with **Compare**, and inspect **RAG Regression Analysis**. ReasonLens should identify the supported → contradicted transition and the provenance score drop.
