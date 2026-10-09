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

## Evaluation benchmark

ReasonLens includes a model-agnostic evaluation runner that evaluates captured traces against the Core RAG Quality Suite.

Open **Evaluations** in the dashboard and choose **Run evaluation**. The benchmark evaluates the traces already stored in ReasonLens; missing cases are explicitly reported and never counted as passes.

A dataset can pin a case to a specific trace with `traceId` when multiple traces share the same prompt:

```json
[{"id":"sla-baseline","name":"SLA baseline","prompt":"Is premium support availability 99.9% monthly?","traceId":"<trace-id>"}]
```

The benchmark reports:
- pass/warn/fail rate
- average provenance score
- evaluated vs missing cases
- average latency and total cost
- per-case quality-gate status
- regression comparison between two evaluation runs

Run the deterministic test suite locally:

```powershell
npm run test:evaluation
```

This evaluates observable artifacts only. It does not inspect or request private model chain-of-thought.

## Replay and evidence debugging

The **Run comparison** view includes an **Evidence diff** panel for two captured traces. It identifies evidence chunks added, removed, or changed, compares rank and retrieval score, and displays the captured LLM request messages when the instrumentation stored them. This comparison does not itself execute the retriever.

To run the bundled PDF/DOCX RAG example again **without calling Groq**, use retrieval-only mode. It repeats document parsing, lexical retrieval, and context assembly, stores a new trace, and records that the LLM was intentionally skipped:

```powershell
$env:PYTHONPATH="sdk/python"
$env:REASONLENS_URL="https://reasonlens.vercel.app"
$env:REASONLENS_INGEST_KEY="<your existing ReasonLens ingest key>"
# Generate sample files only if either fixture is missing.
if (!(Test-Path "sdk/python/examples/data/documents/travel_policy_2026.pdf") -or !(Test-Path "sdk/python/examples/data/documents/expense_policy.docx")) {
  python sdk/python/examples/generate_document_fixtures.py
}
python sdk/python/examples/document_rag.py --retrieval-only --top-k 2
python sdk/python/examples/document_rag.py --retrieval-only --top-k 4
```

For a repeatable batch, run the experiment orchestrator once. It creates a retrieval-only trace for each top-k value, by default 2 and 4:

```powershell
python sdk/python/examples/run_retrieval_experiments.py
```

You can choose other positive values, for example:

```powershell
python sdk/python/examples/run_retrieval_experiments.py --top-k-values 2,4,6
```

The batch does not call Groq by default. To run a full Groq-backed answer for **one selected configuration** while keeping all other configurations retrieval-only, opt in explicitly:

```powershell
python sdk/python/examples/run_retrieval_experiments.py --top-k-values 2,4,6 --full-run-top-k 4
```

That command makes exactly one full-run attempt at top-k 4; top-k 2 and 6 remain retrieval-only. Set `GROQ_API_KEY` only for this opt-in full run. Each configuration produces its own trace for comparison.

Open **Trace history**, select the two newly created traces, and open **Run comparison**. The Evidence diff panel shows which chunks changed between the two retrieval settings. No `GROQ_API_KEY` is needed for retrieval-only mode. The fixture generator writes local sample documents and can overwrite existing fixture files, so run it only when the sample files are missing.

A full end-to-end run uses the same example and current top-k setting but makes a real Groq request:

```powershell
python sdk/python/examples/document_rag.py --top-k 4
```

For full mode, set both `GROQ_API_KEY` and `REASONLENS_INGEST_KEY`. This example uses a deterministic lexical retriever over its bundled PDF/DOCX fixtures; it is a working reference harness, not an automatic runner for an arbitrary external vector database. To replay a customer's own pipeline, instrument and invoke that application's retrieval function.

## License

Apache-2.0.


## Provenance regression demo

Create two real traces—a supported baseline and a deliberately degraded RAG run:

```powershell
$env:PYTHONPATH="sdk/python"
python sdk/python/examples/provenance_regression_demo.py
```

Then open **Trace history**, select the two newest traces with **Compare**, and inspect **RAG Regression Analysis**. ReasonLens should identify the supported → contradicted transition and the provenance score drop.


## Evaluation regression gates

ReasonLens can compare two saved evaluation runs and report whether the current run regressed against a baseline. In the dashboard, open **Evaluations**, select the baseline run first and the current run second, then review the **Baseline vs current regression gate** report. Export either run as JSON from the evaluation history to use the same gate in a release script or CI job.

Default policy:
- Fail if evaluation pass rate drops at all.
- Fail if average provenance score drops by more than 5 points.
- Fail if any matched case degrades in status.
- Fail if the current run has missing evaluation cases.
- Warn if average latency or total estimated cost rises by more than 25%.

Run the gate locally after exporting both JSON files:

```powershell
npx tsx scripts/check-evaluation-regression.ts .\baseline.json .\current.json
```

Exit codes: `0` means PASS or WARN; `1` means a blocking regression; `2` means invalid input or an execution error. Thresholds can be adjusted with environment variables:

```powershell
$env:REASONLENS_MAX_PASS_RATE_DROP="0"
$env:REASONLENS_MAX_PROVENANCE_DROP="5"
$env:REASONLENS_MAX_LATENCY_INCREASE_PERCENT="25"
$env:REASONLENS_MAX_COST_INCREASE_PERCENT="25"
npx tsx scripts/check-evaluation-regression.ts .\baseline.json .\current.json
```

The gate compares captured evaluation results; it does not invoke a model or rerun the application. A release pipeline should create the current evaluation run first, export or fetch the stored baseline/current JSON, then execute this command and treat exit code 1 as a release blocker. Latency and cost thresholds are warnings by default.


## Trace lineage and experiment runs

Each execution is stored as a separate trace. The dashboard can link a new run to a parent trace using **Run variant from this trace**; change the prompt or settings before executing to create an experiment branch. The trace history labels the workflow root or variant, and the workspace lineage panel shows sibling runs, parent IDs, configuration fingerprints, and quick actions to open, compare, branch, or pin a trace into the evaluation dataset.

Lineage metadata is stored in `workflow_id`, `parent_trace_id`, `experiment_id`, and `config_fingerprint` on `public.reasonlens_traces`. Existing traces are backfilled as workflow roots by the migration `supabase/migrations/202610090001_add_trace_lineage.sql`. The deployed Supabase project has this migration applied.

- **Compare** selects lineage traces for the existing run comparison view.
- **Evaluate** pins a trace to the evaluation dataset; pinned trace IDs are fetched directly so older traces are not missed by the default history window.
- A configuration fingerprint is a compact hash of prompt, provider, model, and mode. It identifies an input/config change; it is not a semantic equivalence guarantee.
