# ReasonLens

**See how AI reaches an answer.**

ReasonLens is an open-source AI observability and debugging platform. Inspect recorded chat, RAG, and agent workflows; follow retrieval evidence and tool execution; compare runs; and evaluate observable quality signals. ReasonLens does not expose or claim to reveal hidden model chain-of-thought.

- **Live app:** https://reasonlens.vercel.app/
- **Interactive demo:** https://reasonlens.vercel.app/demo
- **Source code:** https://github.com/talusannni/ReasonLens
- **Issues and bug reports:** https://github.com/talusannni/ReasonLens/issues
- **License:** Apache-2.0

## What you can do

- **Explore traces:** inspect structured execution graphs for chat, RAG, and agent workflows.
- **Follow evidence and provenance:** review retrieval evidence, claims, decisions, tool calls, and recorded support relationships.
- **Compare runs:** compare latency, token usage, estimated cost, supported/unsupported/contradicted claims, and captured evidence changes.
- **Investigate regressions:** review provenance changes and experiment summaries. Mixed-mode comparisons are structural and do not score cross-mode quality as if it were comparable.
- **Evaluate captured traces:** run datasets against stored traces, inspect per-case quality gates, and compare saved evaluation runs.
- **Track experiment lineage:** group workflow variants, inspect parent/child relationships, and pin traces to evaluation cases.
- **Instrument applications:** send traces through the ingestion API using the Python SDK or TypeScript SDK.

ReasonLens evaluates recorded, observable artifacts. A passing check is not independent proof that an answer is factually correct.

## Get running in minutes

### Requirements

- Node.js 20 or newer (LTS recommended)
- npm
- Git

### 1. Clone and install

```bash
git clone https://github.com/talusannni/ReasonLens.git
cd ReasonLens
npm install
```

### 2. Start the app

```bash
npm run dev
```

Open http://localhost:3000/demo to explore the interactive sample traces. The demo uses sample data and does not require a Groq API key or Supabase account.

### 3. Run checks

```bash
npm test
npm run build
```

If you only want to explore the product or contribute to trace-comparison logic, start with the demo and tests. You can do that before configuring hosted authentication or a real LLM provider.

## Configure real model execution

Copy the example environment file to `.env.local` and add your own values:

```bash
cp .env.example .env.local
```

For Groq, set the provider and model in `.env.local`:

```env
REASONLENS_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=openai/gpt-oss-120b
```

Keep credentials server-side. Never commit `.env.local`, API keys, or secrets, and never expose them through `NEXT_PUBLIC_*` variables.

## Run the authenticated workspace locally

The public demo works without backend credentials. To run sign-in, workspace membership, persistent trace storage, and authenticated ingestion locally, configure a Supabase project.

1. Create a Supabase project.
2. Copy the URL, anon key, and service-role key from the project's API settings.
3. Set the required values in `.env.local`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
REASONLENS_SESSION_SECRET=replace-with-a-long-random-secret
REASONLENS_PROVIDER=mock
```

4. Apply the SQL migrations in `supabase/migrations/` to that project in filename order, using the Supabase SQL editor or your preferred migration workflow.
5. Restart `npm run dev` and test sign-up/sign-in.

Do not use production credentials for local development. Never share or commit the service-role key or session secret. Hosted auth and database-backed features cannot be fully exercised until Supabase is configured.

## Instrument an application

The hosted ingestion endpoint is `POST /api/traces`. Configure server-side Supabase credentials and a workspace ingestion key:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-server-only-key
REASONLENS_INGEST_KEY=your-private-ingestion-key
```

Trace ingestion authenticates the bearer key and scopes records to its workspace. API keys are stored as SHA-256 hashes; revoked keys are rejected. The service-role key must remain server-side.

### Python SDK

See [`sdk/python`](sdk/python) for instrumentation examples covering LLM, retrieval, tool, claim, decision, and answer events.

### TypeScript SDK

See [`sdk/typescript/reasonlens.ts`](sdk/typescript/reasonlens.ts) for dependency-light TypeScript instrumentation.

```ts
import { ReasonLens } from './reasonlens';

const rl = new ReasonLens(
  'https://reasonlens.vercel.app',
  process.env.REASONLENS_INGEST_KEY
);

const trace = rl.trace('Answer a customer question', 'agent');
const evidence = trace.retrieval('refund policy', [
  { title: 'Refund policy', content: 'Refunds are allowed within 30 days.' }
]);
trace.tool('get_order', { id: '123' }, { status: 'delivered' });
trace.claim('Order is eligible for refund', [evidence]);
trace.decision('Approve refund');
trace.answer('The order is eligible for a refund.');
await trace.finish();
```

Use an ingestion key issued for your workspace. Never put a service-role key, session secret, or ingestion credential in client-side code or source control.

## Evaluation and quality gates

Quality checks depend on trace mode:

- **Chat:** does not fail provenance checks solely because no retrieval evidence was recorded.
- **RAG:** evaluates recorded evidence and provenance against configured thresholds.
- **Agent:** checks recorded execution outcomes and answer links to tools or decisions; provenance applies when appropriate support relationships are recorded.
- **Retrieval-only runs:** useful for comparing retrieved chunks and prepared context, but excluded from answer-quality evaluation because no new answer was generated.
- **Cross-mode comparisons:** clearly marked as structural; provenance and quality comparisons are not treated as directly comparable.

Evaluation datasets can pin cases to trace IDs. Saved evaluation runs report pass/warn/fail status, missing cases, per-case checks, and baseline-versus-current regressions. Regression thresholds are configurable; latency and cost increases can be warnings.

Run the automated checks locally:

```bash
npm test
npm run build
```

The test scripts cover provenance, quality gates, evaluations, evidence diff, trace execution and comparison, evaluation regression, experiment analysis, API security, security integrity, and tenant isolation. For the non-destructive production health check:

```bash
npm run smoke:production
```

The default target is https://reasonlens.vercel.app. Set `REASONLENS_BASE_URL` to check another deployment.

## Hosted workspace and security boundaries

The hosted app provides public landing/demo routes, account sign-in, and a protected workspace. Workspace membership and API-key sessions are validated server-side, and trace/evaluation access is workspace-scoped. API request limits use shared Supabase buckets and fail closed in production if the shared store is unavailable.

ReasonLens is an evolving project, not a claim of fully mature enterprise SaaS. Review deployment configuration and security controls before production use. Workspace key lifecycle UX, quotas and usage management, audit/retention controls, recovery processes, and a full independent security assessment are separate operational requirements. The live security integration suite is not a comprehensive penetration test.

Relevant server-side environment variables can include:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `REASONLENS_SESSION_SECRET` (server only)
- `GROQ_API_KEY` (server only, when using Groq)
- `REASONLENS_INGEST_KEY` (server-side instrumentation credential)

See `.env.example`, the application, and scripts for exact variables required by each deployment mode.

## Important boundary

ReasonLens displays intentionally recorded execution artifacts—prompts, outputs, retrieval evidence, tool calls, claims, decisions, and their relationships. It does **not** expose or claim to reveal private model chain-of-thought.

## Contributing

1. Fork the repository and create a feature branch.
2. Install dependencies with `npm install`.
3. Start with the interactive demo and run `npm test`.
4. Run `npm run build` before opening a pull request.
5. Include tests for behavior changes and never commit secrets or real customer traces.

For bugs or feature requests, [open a GitHub issue](https://github.com/talusannni/ReasonLens/issues).

## License

Apache-2.0.
