# ReasonLens: Local Setup Guide

This guide takes a new contributor from a fresh clone to a running local ReasonLens instance. It covers the web app, Supabase, optional Groq execution, and tests.

## 1. Prerequisites

- Git
- Node.js 20 or newer (LTS recommended) and npm
- A Supabase account/project for authenticated workspace features and persisted traces
- A Groq API key only if you want live model execution; the mock provider is suitable for starting the UI

Check your versions:

```bash
node --version
npm --version
git --version
```

## 2. Clone and install

```bash
git clone https://github.com/talusannni/ReasonLens.git
cd ReasonLens
npm ci
```

If the repository does not contain a `package-lock.json`, use `npm install` instead of `npm ci`.

## 3. Configure environment variables

Create a local environment file:

**macOS/Linux**
```bash
cp .env.example .env.local
```

**Windows PowerShell**
```powershell
Copy-Item .env.example .env.local
```

Start with mock mode. The app can be explored without a Groq key:

```env
REASONLENS_PROVIDER=mock
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
REASONLENS_SESSION_SECRET=
REASONLENS_INGEST_KEY=
```

Do not commit `.env.local`. Never prefix secrets with `NEXT_PUBLIC_` or expose a Supabase service-role key to browser code.

Generate a strong session secret for local use. For example, with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output into `REASONLENS_SESSION_SECRET`.

## 4. Create and configure Supabase

1. Create a new project at https://supabase.com/dashboard. Use a development project, not your production database.
2. In **Project Settings → API** (or **Connect**, depending on the dashboard version), copy the project URL and the publishable/anon key into `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
3. Copy the **service_role** secret into `SUPABASE_SERVICE_ROLE_KEY`. This is server-only and must never be shared, committed, or used in client-side code.
4. In the repository, open `supabase/migrations/`. Apply every SQL migration to the new project in filename/chronological order using the Supabase SQL Editor, starting with the earliest migration. Wait for each migration to succeed before running the next. Do not skip migrations or apply them to a production project just to get local development working.
5. Review the Supabase **Authentication → URL Configuration** settings. For local development, add `http://localhost:3000` as a site URL and add the local authentication callback/redirect URL used by the app to the allowed redirect URLs. For hosted previews and production, configure their actual URLs separately.
6. Keep the development project isolated from production. Never copy production service-role credentials into a contributor's local environment.

If Supabase Auth, workspace provisioning, or persisted trace operations fail, first check that every migration ran successfully and that the URL and keys all belong to the same Supabase project.

## 5. Run the application

```bash
npm run dev
```

Open http://localhost:3000.

Start with the public demo to inspect example traces. Sign-in, workspace provisioning, database-backed history, and authenticated ingestion require a correctly configured Supabase project and any provider-specific settings. A local UI boot alone does not prove that Supabase integration is configured.

## 6. Optional: enable live Groq requests

1. Create a Groq API key from https://console.groq.com/keys.
2. Set these server-side variables in `.env.local`:

```env
REASONLENS_PROVIDER=groq
GROQ_API_KEY=your-groq-api-key
GROQ_MODEL=openai/gpt-oss-120b
```

3. Restart `npm run dev` after changing environment variables.

Use a model currently available to your Groq account. Do not commit the key.

## 7. Run checks

Run the automated unit/integration-style test suite and production build:

```bash
npm test
npm run build
```

The suite includes TypeScript checks, provenance, quality gates, evaluations, evidence diff, trace execution/comparison, regression analysis, API security, security integrity, and tenant isolation.

The production smoke test is read-only:

```bash
npm run smoke:production
```

To run the live security integration suite, read [Security Testing](docs/SECURITY_TESTING.md) first. It creates real test workspaces and API keys and performs writes; use a preview/staging deployment and a dedicated development Supabase project.

## 8. SDKs

- Python SDK and examples: [`sdk/python`](sdk/python)
- TypeScript SDK: [`sdk/typescript/reasonlens.ts`](sdk/typescript/reasonlens.ts)

For trace ingestion, configure an ingestion key for the target workspace and use it as a bearer credential. Do not use the Supabase service-role key as an ingestion key.

## Troubleshooting

- **App starts, but login/workspace fails:** verify the Supabase URL, anon key, service-role key, auth URL configuration, and migration status.
- **Trace ingestion returns 401:** verify the workspace ingestion key and ensure the request sends it as a bearer token.
- **Database errors after setup:** confirm all migrations were applied in order to the same Supabase project configured in `.env.local`.
- **Groq requests fail:** verify the key and model are valid for your Groq account and that `REASONLENS_PROVIDER=groq`.
- **Environment changes appear ignored:** stop and restart the Next.js development server.
- **Dependency install fails:** check your Node.js/npm versions and use `npm install` if the lockfile is absent.

## Deployment notes

Local setup is separate from deploying the hosted application. Vercel deployments need the appropriate server-side environment variables configured in the Vercel project, and Supabase Authentication must allow the deployment's real URL. Do not run schema migrations against production without reviewing the SQL and planning for the existing data.

For security reports and test-workspace cleanup details, see [Security Testing](docs/SECURITY_TESTING.md).
