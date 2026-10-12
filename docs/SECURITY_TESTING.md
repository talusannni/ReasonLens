# Live security integration tests

`npm run test:security-live` sends real HTTP requests to a running ReasonLens deployment and tests the actual API-key authentication and workspace-scoped trace persistence.

## Safety requirements

- Use a dedicated staging deployment and a dedicated Supabase test project.
- Create three separate active test workspaces and one API key per workspace.
- Do not use production customer data or production API keys.
- The test creates temporary traces and deletes only those exact trace IDs using the test Supabase service-role credential in a finally block.
- The script refuses to run unless `REASONLENS_SECURITY_TEST_ALLOW_WRITES=true`.
- Production Vercel domains are blocked unless `REASONLENS_SECURITY_TEST_ALLOW_PRODUCTION=true` is set. Running against production is not recommended.
- Never put real secrets in this file, source control, command-line arguments, or CI logs.

## Required environment variables

Set these in your local shell or a local untracked environment file:

- `REASONLENS_SECURITY_TEST_BASE_URL`: base URL of the test deployment.
- `REASONLENS_SECURITY_TEST_TEAM_A_KEY`, `REASONLENS_SECURITY_TEST_TEAM_B_KEY`, `REASONLENS_SECURITY_TEST_TEAM_C_KEY`: separate API keys provisioned for each test workspace.
- `REASONLENS_SECURITY_TEST_TEAM_A_WORKSPACE_ID`, `REASONLENS_SECURITY_TEST_TEAM_B_WORKSPACE_ID`, `REASONLENS_SECURITY_TEST_TEAM_C_WORKSPACE_ID`: matching workspace UUIDs. The suite uses these only for cleanup scope checks.
- `REASONLENS_SECURITY_TEST_SUPABASE_URL`: URL for the same test Supabase project used by the deployment.
- `REASONLENS_SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY`: test-project service-role key, used only to remove records created by this test.
- `REASONLENS_SECURITY_TEST_ALLOW_WRITES=true`: explicit confirmation that writes to the test environment are permitted.

## Run

```bash
npm run test:security-live
```

The test checks unauthenticated and invalid-key rejection, writes one synthetic trace per team, verifies each team sees its own trace but not the other teams' traces, rejects malformed and oversized payloads, and attempts to delete the exact test records it created.

If cleanup reports a warning, manually remove the listed trace ID using the test project's Supabase dashboard. Do not run this against a shared or production project.

This is an integration test, not a comprehensive penetration test. It does not replace dedicated checks for CSRF, XSS, SQL/PostgREST injection, brute-force behavior, denial-of-service resistance, dependency vulnerabilities, or authorization coverage for every route.
