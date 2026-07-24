# Database Operations

This guide covers the repository-owned PostgreSQL migration workflow. Run the
commands against disposable local services during development. A hosted
database requires a separate, explicit change authorization and a completed
readiness record.

## Authority and safety boundary

`backend/server/database/migrationRegistry.ts` is the schema authority. The
registry uses strictly ordered capability names, immutable SHA-256 checksums,
one transaction per migration, and a PostgreSQL advisory lock. Both
`npm run setup:db` and `npm run migrate:db` execute this registry; the setup
command is not a separate schema definition.

The compatibility wrappers `migrate:events` and `migrate:contracts` invoke the
same complete registry. They are retained for existing automation, not for
selective migration.

Never place database URLs, credentials, provider account details, backup
files, or production row data in the repository or command output captured in
Git. Keep them in the deployment provider's secret manager.

## Required hosted readiness record

Before authorizing any hosted migration, record these deployment-specific
values in the approved operations system:

- provider, project, environment, database name, and accountable owner,
  without copying credentials;
- backup method and point-in-time recovery availability;
- actual retention period, recovery point objective (RPO), and recovery time
  objective (RTO);
- latest successful backup time and the recovery point retained for this
  change;
- latest isolated restore drill time, owner, and evidence location;
- historical database timezone used by legacy timestamp conversion;
- deployed backend, Pass, and Scan revisions;
- whether deployed Scan builds can contain pending `legacy-incident-<row>` or
  `legacy-override-<row>` identities;
- read-only preflight counts for integrity, time, legacy queue, override-link,
  membership, constraint, index, and migration-ledger conditions.

There are no repository-wide default RPO, RTO, or retention values. The
operator must use the values guaranteed by the selected deployment and confirm
that they satisfy the service's recovery requirements.

## Read-only migration status

From `backend/`, configure the target through the existing environment
variables and run:

```powershell
npm run migrate:status
```

This is the migration dry run. It reads the ledger when present and prints the
exact applied and pending migration ids, names, and checksums. It does not
create the ledger or apply DDL. Treat any unknown applied id, name mismatch, or
checksum mismatch as a stop condition. Do not edit a committed migration to
make the status pass; add a new ordered capability migration.

For a blank disposable database, `npm run setup:db` applies the same registry.
For an existing database, use `npm run migrate:db` only after all readiness and
restore gates pass.

## Backup and isolated restore gate

Use the provider's supported backup and point-in-time recovery procedures.
Before migration authorization:

1. Capture a new recovery point and retain it for the approved observation
   window.
2. Restore the latest backup into a new, isolated database that cannot receive
   application traffic.
3. Connect with a separate least-privilege validation identity.
4. Compare representative table row counts with the source snapshot.
5. run `npm run migrate:status` against the restored database;
6. validate expected constraints and indexes from PostgreSQL catalogs;
7. run representative read-only application queries and record their results;
8. record restore duration against the deployment-specific RTO; and
9. destroy the isolated restore according to the provider's approved data
   retention process after evidence has been retained.

A backup configuration without a successful isolated restore is not restore
proof. Stop if the restore, connection, counts, constraints, or representative
queries do not agree.

## Rollout

After separate hosted authorization:

1. Confirm the readiness record and isolated restore evidence are current.
2. Deploy backward-compatible application code if old and new schema must
   coexist during rollout.
3. Drain or pause writes when the approved migration needs a maintenance
   window.
4. Run `npm run migrate:status` and save the applied/pending output in the
   operations record.
5. Run `npm run migrate:db` once.
6. Run `npm run migrate:status` again; pending must be empty and every checksum
   must match the reviewed registry.
7. Verify schema fingerprint, row counts, constraints, representative queries,
   and application smoke tests.
8. Resume traffic and monitor database errors, request latency, access denials,
   queue acknowledgement outcomes, and client sync health.
9. Retain the pre-migration recovery point through the approved observation
   window.

Release the Scan installation-identity migration only after the installed-base
inventory and lost-ack reconciliation policy are approved. Source builds that
encounter already-assigned weak queue identities stop before changing them.

## Failure and recovery

Each capability migration rolls back its own DDL and ledger row on failure. A
failed command should therefore be investigated and rerun only after its cause
is understood. Do not delete ledger rows, change recorded checksums, or mark
capabilities applied manually.

Rollback is capability-specific:

- prefer a reviewed forward fix for additive schema changes;
- do not reverse timezone conversions or historical repairs automatically;
- if integrity or data correctness is uncertain, keep writes drained and use
  the proven restore/reconciliation procedure;
- record the selected recovery point, lost-write interval, and operator
  decision against the approved RPO/RTO.

## Destructive demo seed refusal

`npm run seed:db` is for an explicitly confirmed disposable development
database only. It refuses to run unless all of these conditions hold:

- `ALLOW_DATABASE_SEED=true`;
- `SEED_DATABASE_NAME_CONFIRMATION` exactly matches
  `SELECT current_database()`; and
- `NODE_ENV` is not `production`.

The seed transaction deletes event-scoped demo data and related cascades before
replacing it. Missing acknowledgement, a mismatched database name, production
mode, hashing failure, or database failure aborts without a committed partial
seed. Never use this command as a migration, recovery, or hosted-data repair
tool.

## Evidence boundary

Repository tests and disposable PostgreSQL runs establish source behavior.
They do not prove hosted backup availability, provider retention, restore
success, deployed revisions, production performance, or physical-device queue
state. Record those facts separately before hosted rollout.
