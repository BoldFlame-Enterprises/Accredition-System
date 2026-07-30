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

`POST /api/notifications/send` requires one explicit audience:
`{ audience: "event", confirm_broadcast: true }` or
`{ audience: "users", user_ids: [...] }`. Mixed, empty, duplicate,
non-member, omitted, or unconfirmed audiences are rejected before enqueue.
The event members and their active registration-backed device tokens are
snapshotted when the job is created, so later token changes cannot silently
expand the intended audience. The API returns `202` with `job_id` and `queued`
status; provider delivery never runs inside the request. Query
`GET /api/notifications/jobs/:id?event_id=<id>` for event-scoped status,
recipient-state totals, and ordered history. Global administrators and active
administrators of that event may read it; a job from another event is not
returned. Raw push tokens are not returned by the status API.

The in-process worker:

1. claims one available recipient row with `FOR UPDATE SKIP LOCKED`;
2. increments its bounded attempt count and assigns an unguessable lease
   fencing token;
3. renews the lease before half its lifetime while provider work remains in
   flight;
4. sends only the snapshotted token, with provider deadlines and bounded
   concurrency;
5. finishes only if owner, fencing token, and attempt number still match; and
6. aggregates the parent as `delivered`, `partially_delivered`,
   `blocked_configuration`, or `failed`.

Sent recipients are never reclaimed because another recipient failed.
Retryable failures receive bounded exponential delay. Attributable permanent
token failures deactivate that exact event token. APNs-disabled work becomes
`blocked_configuration`, never delivered. A stale worker whose lease was
reclaimed cannot finish or requeue the row. Shutdown stops polling and waits
for the worker's active operation before PostgreSQL disconnects.

Monitor recipient queue depth and oldest availability time, processing leases
past expiry, retry counts, terminal/permanent rows, partial jobs,
blocked-configuration jobs, provider latency/error ratios, and worker loop
errors. Alert on a growing oldest age, repeated lease recovery, or sustained
partial/blocked states. Push is an accelerator only; authorization continues
to come from the server and foreground synchronization.
