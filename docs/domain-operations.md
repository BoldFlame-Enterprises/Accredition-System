# Domain workflow operations

This guide covers the bounded user-import, report-export, and notification
delivery workflows.

## Identity import

- The request body is limited by the API body policy and the importer accepts
  at most 1 MiB and 1,000 data rows.
- CSV is parsed with the pinned `csv-parse` RFC 4180 implementation. Required
  headers are `email`, `name`, and `phone`; `role` is optional.
- The complete file is normalized and validated before a database client is
  checked out. Duplicate normalized emails, duplicate headers, malformed
  records, and invalid fields reject the complete request.
- All new identities and activation challenges commit in one transaction.
  Existing identities are reported as skipped. A database or challenge failure
  rolls back every new row.
- Pending identities use an unusable verifier hash. An administrator can issue
  a fresh audited activation challenge with
  `POST /api/users/:id/reissue-activation`.

Never place imported CSV content, activation tokens, or personal fields in
application logs.

## CSV exports

User and scan exports use one spreadsheet-safe CSV encoder. Cells beginning
with `=`, `+`, `-`, `@`, tab, or carriage return are neutralized before
standards-compliant quoting.

Synchronous exports are limited to 50,000 rows. The server counts the
event-scoped result before sending headers, then reads and writes 1,000-row
keyset pages with response backpressure. If the client disconnects, pagination
stops. A `413` response means the caller must narrow the event/time/data scope;
the dashboard will show that error rather than download JSON as a CSV file.

Monitor export duration, database query latency, response aborts, process
memory, and event-loop delay.

## Notification delivery jobs

`POST /api/notifications/send` validates and normalizes the complete command,
persists a job, and returns `202` with `job_id` and `queued` status. Provider
delivery never runs inside the API request. Query
`GET /api/notifications/jobs/:id?event_id=<id>` for event-scoped status,
provider totals, and ordered attempt history. Global administrators and active
administrators of that event may read it; a job from another event is not
returned.

The in-process worker:

1. claims one queued or expired job with `FOR UPDATE SKIP LOCKED`;
2. atomically records the attempt, increments its number, and leases it for 30
   seconds;
3. sends FCM batches of at most 500 and APNs requests with concurrency 20 and
   ten-second deadlines;
4. records an immutable attempt row and either completes or schedules a bounded
   exponential retry; and
5. adds job/attempt identifiers to provider data so clients can de-duplicate.

Jobs have at most three attempts by default. Expired processing leases are
recoverable after a crash and the abandoned attempt is retained with a
`LEASE_EXPIRED` code. Shutdown stops polling and waits for the active attempt
before PostgreSQL disconnects.

Monitor queue depth, oldest queued age, expired leases, terminal failures,
provider failure ratios, and worker loop errors. Push is an accelerator only;
authorization continues to come from the server and foreground synchronization.
