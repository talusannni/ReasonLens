# Live security integration tests

`npm run test:security-live` provisions three API-key workspaces when needed, then sends real HTTP requests to the configured ReasonLens deployment and verifies API authentication and workspace-scoped trace persistence.

## Required environment variables

Set these locally; never commit the service-role key:

- `REASONLENS_SECURITY_TEST_BASE_URL`: base URL of a preview/staging deployment.
- `REASONLENS_SECURITY_TEST_SUPABASE_URL`: Supabase URL used by that deployment. It can be the existing project if you deliberately want to test against it.
- `REASONLENS_SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY`: service-role key for that Supabase project. It is used to provision test workspaces/API keys and clean up test-created traces.
- `REASONLENS_SECURITY_TEST_ALLOW_WRITES=true`: explicit confirmation that provisioning and trace writes are allowed.

## What the suite provisions

On its first run, the script creates three active workspaces with unique slugs:

- Security Test Alpha
- Security Test Bravo
- Security Test Charlie

It creates one random API key for each workspace and stores only the SHA-256 hash in `reasonlens_api_keys`. The plaintext API keys and workspace UUIDs are saved to `.security-test-credentials.json` in the local working directory. That file is git-ignored. Treat it like a secret; do not upload it or paste it into chat.

On later runs, the script reuses the local credentials file when it matches the configured Supabase URL. If you lose the file or need to rotate credentials, securely remove the local file and rerun the script; that will provision a new set of workspaces. Existing workspaces/keys are intentionally not deleted automatically, so you can inspect or remove them deliberately in Supabase.

These are API-key workspaces, not email/password dashboard accounts.

## Run

```bash
npm run test:security-live
```

The suite verifies unauthenticated and invalid-key rejection, creates one synthetic trace per team, confirms each team sees its own trace but not the other teams' traces, rejects malformed and oversized payloads, and deletes only the exact synthetic trace IDs created during the run. The three workspaces and API keys remain available for reuse.

## Safety

- Production Vercel domains are blocked by default. Use a preview/staging deployment even when it connects to the same Supabase project.
- To intentionally override the production block, set `REASONLENS_SECURITY_TEST_ALLOW_PRODUCTION=true`. This is not recommended because the script performs real writes.
- The suite writes test workspaces, API-key hashes, and temporary synthetic traces to Supabase. Review the target URL before enabling writes.
- If cleanup reports a warning, inspect the named trace ID and workspace ID in Supabase before manually removing anything.
- This is an integration suite, not a comprehensive penetration test. It does not cover all CSRF, XSS, injection, brute-force, denial-of-service, dependency, or route-authorization risks.
