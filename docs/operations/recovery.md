# ReasonLens backup and recovery runbook

This runbook is intentionally operator-driven. ReasonLens does not create or restore Supabase backups automatically.

## Before production release

1. Identify the Supabase plan and verify which backup and point-in-time recovery (PITR) features are actually enabled for that project.
2. Record the recovery point objective (RPO), recovery time objective (RTO), on-call owner, and escalation contact.
3. Confirm that backups cover the project database and that required encryption/access controls are in place.
4. Perform a restore rehearsal into a separate Supabase project. Never use production as the restore target.
5. Keep `SUPABASE_SERVICE_ROLE_KEY`, `REASONLENS_SESSION_SECRET`, `GROQ_API_KEY`, and all workspace API keys in a secret manager; do not include them in exports, screenshots, tickets, or this runbook.

## Recovery procedure

1. Declare an incident and record the last known healthy deployment, database project, and approximate recovery point.
2. Use the Supabase dashboard's supported backup/PITR workflow for the configured plan to restore into a separate project. Do not assume PITR is available unless verified.
3. Point a staging deployment at the restored project using new server-side environment configuration.
4. Apply any migrations that were committed after the restored backup, in chronological order. Review each migration before applying it.
5. Verify that the default workspace exists and that the expected workspace, API-key, trace, and evaluation tables exist.
6. Call `GET /api/health` and `GET /api/health/ready`. The first confirms process liveness; the second confirms the app can query Supabase.
7. Run the non-destructive smoke suite against staging with `REASONLENS_BASE_URL` set to the staging URL. Use the Vercel automation-bypass secret only when deployment protection requires it.
8. Validate a controlled test workspace with a newly issued API key. Confirm that its trace ingestion and retrieval work and that a second workspace cannot read those records.
9. Compare record counts and the restored timestamp with the selected recovery point. Document any expected loss of records written after that point.
10. Only after approval, update the production deployment's Supabase environment variables or perform the provider-supported failover. Keep the previous project intact until service is stable and the incident owner authorizes cleanup.

## Schema-change safety

- Back up and rehearse restoration before migrations that change data or constraints.
- The workspace rate-limit migration must be applied before the release that calls `reasonlens_consume_rate_limit` and `reasonlens_delete_workspace`.
- Run migrations in staging first. A code rollback does not automatically roll back a database migration.
- The workspace deletion command is irreversible from the application. Use its dry-run output, export required data, and verify a recent backup before adding `--apply`.
- Record the migration version, deployment commit, test results, restore point, and operator approval in the incident/release log.

## Monitoring

Configure external uptime/alerting to monitor liveness, readiness, scheduled smoke-test results, and HTTP 5xx trends. Alert on repeated readiness failures and failed smoke checks. Avoid including trace prompts, answers, API keys, or cookies in monitoring payloads.

## Known limitations

- Backup creation and restoration are not automated by this repository.
- There is no automated failover, tested RPO/RTO guarantee, or built-in audit log for administrative deletions.
- A restored database may contain revoked-key state from the chosen recovery point; re-check key revocations and rotate credentials if the recovery point predates a security incident.
- Existing signed dashboard sessions are not immediately invalidated by API-key revocation; use the documented seven-day session expiry as a limitation, not a revocation guarantee.
