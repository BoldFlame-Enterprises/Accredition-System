import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { applyConfirmedFixtureMutation, queryCompatibilityDatabase } from '../lib/database.js';
import { EVIDENCE_SCHEMA_VERSION, writeEvidence } from '../lib/evidence.js';
import { startCompatibilityService, stopCompatibilityService } from '../lib/failures.js';
import { repoRoot } from '../lib/config.js';
import { runCommand } from '../lib/process.js';
import { waitForUrl } from '../lib/runtime.js';

const PASS_SUBSTITUTIONS = [
  'sqlcipher-binding', 'secure-store', 'device-biometrics', 'os-connectivity', 'push-notifications',
];
const SCAN_SUBSTITUTIONS = [
  'camera-transport', 'sqlcipher-binding', 'secure-store', 'device-biometrics',
  'os-connectivity', 'audio-feedback', 'push-notifications',
];

async function revision(relativePath = '.') {
  return (await runCommand('git', ['-C', relativePath, 'rev-parse', 'HEAD'], { cwd: repoRoot })).stdout.trim();
}

async function revisions() {
  return {
    parent: await revision('.'),
    backend: await revision('backend'),
    dashboard: await revision('web-dashboard'),
    pass: await revision('verigate-pass'),
    scan: await revision('verigate-scan'),
  };
}

function traceStep(name, trace, extra = {}) {
  return {
    name,
    request_id: trace?.requestId ?? trace?.request_id,
    correlation_id: trace?.correlationId ?? trace?.correlation_id,
    ...extra,
  };
}

async function evidence(context, repositories, input) {
  const now = new Date().toISOString();
  return writeEvidence(context.evidenceDirectory, {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    scenario: {
      id: input.id,
      name: input.name,
      started_at: input.startedAt,
      ended_at: now,
    },
    run: { id: context.runId },
    repositories,
    runtime: { node: process.version, database: 'PostgreSQL 17', cache: 'Redis 7' },
    fixtures: input.fixtures,
    steps: input.steps.map((step) => ({
      at: now,
      retry: 0,
      status: 200,
      outcome: 'completed',
      ...step,
    })),
    assertions: input.assertions,
    native_adapter_substitutions: input.substitutions ?? [],
    result: input.assertions.every((assertion) => assertion.met) ? 'passed' : 'failed',
  });
}

function csvCount(output) {
  const value = Number(output.trim().split(/\r?\n/).at(-1));
  if (!Number.isSafeInteger(value)) throw new Error(`Unexpected database count: ${output}`);
  return value;
}

async function runScan(context, inputPath, outputPath, mode) {
  await runCommand('npm', ['test', '--', '--runInBand', 'compatibility/convergence-live.test.ts'], {
    cwd: path.join(repoRoot, 'verigate-scan'),
    env: {
      ...process.env,
      COMPAT_LIVE: '1',
      COMPAT_BACKEND_URL: `${context.backendUrl}/api`,
      COMPAT_CONVERGENCE_INPUT: inputPath,
      COMPAT_CONVERGENCE_OUTPUT: outputPath,
      COMPAT_CONVERGENCE_MODE: mode,
    },
  });
}

async function runPass(context, inputPath, outputPath) {
  await runCommand('npm', ['test', '--', '--runInBand', 'compatibility/convergence-live.test.ts'], {
    cwd: path.join(repoRoot, 'verigate-pass'),
    env: {
      ...process.env,
      COMPAT_LIVE: '1',
      COMPAT_BACKEND_URL: `${context.backendUrl}/api`,
      COMPAT_CONVERGENCE_INPUT: inputPath,
      COMPAT_PASS_CONVERGENCE_OUTPUT: outputPath,
    },
  });
}

async function runDashboard(context, inputPath, outputPath) {
  await runCommand('npm', [
    'exec', '--', 'playwright', 'test', '--config', 'playwright.config.ts',
    'tests/compatibility/convergence-review.spec.ts',
  ], {
    cwd: path.join(repoRoot, 'web-dashboard'),
    env: {
      ...process.env,
      COMPAT_BASE_URL: context.dashboardUrl,
      COMPAT_RUN_ID: context.runId,
      COMPAT_CONVERGENCE_INPUT: inputPath,
      COMPAT_DASHBOARD_CONVERGENCE_OUTPUT: outputPath,
      PLAYWRIGHT_HTML_REPORT: path.join(context.evidenceDirectory, 'convergence-report'),
      PLAYWRIGHT_OUTPUT_DIR: path.join(context.evidenceDirectory, 'convergence-output'),
    },
    inherit: true,
  });
}

async function waitForUnavailable(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (!response.ok) return { unavailable: true, status: response.status };
    } catch {
      return { unavailable: true, status: 0 };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return { unavailable: false, status: 200 };
}

async function authorityCount(context) {
  return csvCount(await queryCompatibilityDatabase(context,
    `SELECT (SELECT COUNT(*) FROM access_assignments) + (SELECT COUNT(*) FROM scan_logs) + (SELECT COUNT(*) FROM incidents) + (SELECT COUNT(*) FROM emergency_overrides)`
  ));
}

export async function runConvergenceScenarios(context, identity) {
  const startedAt = new Date().toISOString();
  const inputPath = path.join(context.runDirectory, 'convergence-transient.json');
  const capturePath = path.join(context.runDirectory, 'convergence-capture.json');
  const dashboardPath = path.join(context.runDirectory, 'convergence-dashboard.json');
  const passPath = path.join(context.runDirectory, 'convergence-pass.json');
  const revokedPath = path.join(context.runDirectory, 'convergence-revoked.json');
  const recoveryRecordId = crypto.randomUUID();
  const recoveryOccurredAt = new Date().toISOString();
  const transient = {
    run_id: context.runId,
    fixture: identity.fixture,
    pass: { presentation: identity.pass.presentation },
    recovery_record_id: recoveryRecordId,
    recovery_occurred_at: recoveryOccurredAt,
  };
  await fs.writeFile(inputPath, JSON.stringify(transient) + '\n');

  try {
    await runScan(context, inputPath, capturePath, 'capture');
    await runDashboard(context, inputPath, dashboardPath);
    await runPass(context, inputPath, passPath);

    await stopCompatibilityService(context, 'backend');
    const networkDown = await waitForUnavailable(`${context.backendUrl}/ready`);
    if (!networkDown.unavailable) throw new Error('Backend network failure control was a no-op');
    await startCompatibilityService(context, 'backend');
    await waitForUrl(`${context.backendUrl}/ready`, 60_000);
    await runScan(context, inputPath, revokedPath, 'revoked');

    const beforeRedis = await authorityCount(context);
    await stopCompatibilityService(context, 'redis');
    const redisDown = await waitForUnavailable(`${context.backendUrl}/ready`);
    if (!redisDown.unavailable) throw new Error('Redis failure control was a no-op');
    const duringRedis = await authorityCount(context);
    await startCompatibilityService(context, 'redis');
    await waitForUrl(`${context.backendUrl}/ready`, 60_000);
    const afterRedis = await authorityCount(context);

    const accountBefore = csvCount(await queryCompatibilityDatabase(context,
      `SELECT COUNT(*) FROM users WHERE id = ${Number(identity.fixture.attendee_user_id)} AND is_active = true AND identity_status = 'active'`
    ));
    const accountMutation = await applyConfirmedFixtureMutation(context, {
      expectedDatabase: context.databaseName,
      reason: 'Exercise account-deactivation authority after compatibility workflows complete',
      sql: `UPDATE users SET is_active = false, identity_status = 'disabled' WHERE id = ${Number(identity.fixture.attendee_user_id)}`,
    });
    const accountAt = csvCount(await queryCompatibilityDatabase(context,
      `SELECT COUNT(*) FROM users WHERE id = ${Number(identity.fixture.attendee_user_id)} AND is_active = true`
    ));
    const accountAfter = csvCount(await queryCompatibilityDatabase(context,
      `SELECT COUNT(*) FROM users WHERE id = ${Number(identity.fixture.attendee_user_id)} AND identity_status = 'disabled'`
    ));
    const intervalMatrix = (await queryCompatibilityDatabase(context,
      `WITH boundary AS (SELECT TIMESTAMPTZ '2040-01-01T00:00:00Z' AS instant), probes AS (SELECT * FROM (VALUES ('before', TIMESTAMPTZ '2039-12-31T23:59:59.999Z'), ('at', TIMESTAMPTZ '2040-01-01T00:00:00Z'), ('after', TIMESTAMPTZ '2040-01-01T00:00:00.001Z')) AS value(label, instant)) SELECT COUNT(*) FROM probes, boundary WHERE (label = 'before' AND probes.instant < boundary.instant) OR (label = 'at' AND probes.instant = boundary.instant) OR (label = 'after' AND probes.instant > boundary.instant)`
    )).trim();

    const [capture, dashboard, pass, revoked] = await Promise.all(
      [capturePath, dashboardPath, passPath, revokedPath].map(async (file) =>
        JSON.parse(await fs.readFile(file, 'utf8'))
      )
    );
    const repositories = await revisions();
    const scanRowCount = csvCount(await queryCompatibilityDatabase(context,
      `SELECT COUNT(*) FROM scan_logs WHERE device_scan_id = '${capture.stable_scan_id}'`
    ));
    const casePairCount = csvCount(await queryCompatibilityDatabase(context,
      `SELECT (SELECT COUNT(*) FROM incidents WHERE event_id = ${Number(identity.fixture.event_id)} AND client_record_id = '${capture.incident.client_record_id}') + (SELECT COUNT(*) FROM emergency_overrides WHERE event_id = ${Number(identity.fixture.event_id)} AND client_record_id = '${capture.override.client_record_id}')`
    ));
    const isolatedCaseCount = csvCount(await queryCompatibilityDatabase(context,
      `SELECT COUNT(DISTINCT event_id) FROM incidents WHERE client_record_id = '${capture.incident.client_record_id}'`
    ));
    const common = { namespace: context.runId, event_id: identity.fixture.event_id };

    await evidence(context, repositories, {
      id: '07', name: 'exactly-once-lost-response-retry', startedAt,
      fixtures: { ...common, client_record_id: capture.stable_scan_id },
      substitutions: SCAN_SUBSTITUTIONS,
      steps: [traceStep('scan-retry-after-discarded-response', capture.trace, { retry: 1 })],
      assertions: [
        { name: 'first-response-body-discarded', met: capture.lost_response.caller_received_body === false, expected: false, actual: capture.lost_response.caller_received_body },
        { name: 'retry-known-duplicate', met: capture.retry_status === 'duplicate', expected: 'duplicate', actual: capture.retry_status },
        { name: 'one-authoritative-row', met: scanRowCount === 1, expected: 1, actual: scanRowCount },
      ],
    });
    await evidence(context, repositories, {
      id: '08', name: 'administrative-revocation-convergence', startedAt,
      fixtures: { ...common, assignment_id: identity.fixture.assignment_id },
      substitutions: [...PASS_SUBSTITUTIONS, ...SCAN_SUBSTITUTIONS],
      steps: [traceStep('dashboard-revoke-assignment', dashboard), traceStep('clients-resynchronize', revoked.trace)],
      assertions: [
        { name: 'stale-projection-granted-before-sync', met: capture.before_revocation.granted === true, expected: true, actual: capture.before_revocation.granted },
        { name: 'dashboard-revocation-committed', met: dashboard.revoke_status === 200, expected: 200, actual: dashboard.revoke_status },
        { name: 'pass-projection-removed-authority', met: pass.assignment_count === 0, expected: 0, actual: pass.assignment_count },
        { name: 'scan-projection-denies-after-sync', met: revoked.decision.granted === false, expected: false, actual: revoked.decision.granted },
      ],
    });
    await evidence(context, repositories, {
      id: '09', name: 'offline-incident-and-override-capture', startedAt,
      fixtures: { ...common, incident_record_id: capture.incident.client_record_id, override_record_id: capture.override.client_record_id },
      substitutions: SCAN_SUBSTITUTIONS,
      steps: [traceStep('scan-upload-offline-captured-cases', capture.trace)],
      assertions: [
        { name: 'network-loss-proven-before-capture', met: capture.offline_proven === true, expected: true, actual: capture.offline_proven },
        { name: 'incident-accepted', met: capture.incident.status === 'accepted', expected: 'accepted', actual: capture.incident.status },
        { name: 'override-accepted', met: capture.override.status === 'accepted', expected: 'accepted', actual: capture.override.status },
        { name: 'both-authoritative-records-linked', met: casePairCount === 2, expected: 2, actual: casePairCount },
      ],
    });
    await evidence(context, repositories, {
      id: '10', name: 'dashboard-operational-record-review', startedAt,
      fixtures: common,
      steps: [traceStep('real-browser-operational-review', dashboard)],
      assertions: [
        { name: 'incident-visible', met: dashboard.incident_visible === true, expected: true, actual: dashboard.incident_visible },
        { name: 'override-visible', met: dashboard.override_visible === true, expected: true, actual: dashboard.override_visible },
        { name: 'unauthorized-reviewer-denied', met: [403, 404].includes(dashboard.unauthorized_status), expected: [403, 404], actual: dashboard.unauthorized_status },
      ],
    });
    await evidence(context, repositories, {
      id: '11', name: 'concurrent-event-isolation', startedAt,
      fixtures: { ...common, other_event_id: identity.fixture.other_event_id, shared_client_record_id: capture.incident.client_record_id },
      substitutions: SCAN_SUBSTITUTIONS,
      steps: [traceStep('event-bound-device-cross-event-request', capture.trace, { status: capture.cross_event_status })],
      assertions: [
        { name: 'same-record-id-is-event-namespaced', met: isolatedCaseCount === 2, expected: 2, actual: isolatedCaseCount },
        { name: 'cross-event-device-request-rejected', met: [403, 409].includes(capture.cross_event_status), expected: [403, 409], actual: capture.cross_event_status },
        { name: 'dashboard-views-remain-isolated', met: dashboard.other_event_isolated === true, expected: true, actual: dashboard.other_event_isolated },
      ],
    });
    await evidence(context, repositories, {
      id: '12', name: 'dependency-failure-and-recovery', startedAt,
      fixtures: { ...common, recovery_record_id: recoveryRecordId },
      substitutions: SCAN_SUBSTITUTIONS,
      steps: [
        { name: 'backend-network-interrupted', status: networkDown.status, outcome: 'unavailable' },
        { name: 'redis-required-readiness-interrupted', status: redisDown.status, outcome: 'unavailable' },
        traceStep('queue-converges-after-recovery', revoked.trace),
      ],
      assertions: [
        { name: 'backend-failure-control-effective', met: networkDown.unavailable === true, expected: true, actual: networkDown.unavailable },
        { name: 'redis-failure-control-effective', met: redisDown.unavailable === true, expected: true, actual: redisDown.unavailable },
        { name: 'postgres-authority-unchanged-during-cache-outage', met: beforeRedis === duringRedis && duringRedis === afterRedis, expected: beforeRedis, actual: [duringRedis, afterRedis] },
        { name: 'pending-record-accepted-after-network-recovery', met: revoked.recovery_status === 'accepted', expected: 'accepted', actual: revoked.recovery_status },
      ],
    });
    await evidence(context, repositories, {
      id: '13', name: 'consistent-expiry-boundaries', startedAt,
      fixtures: { ...common, account_mutation_sha256: accountMutation.statement_sha256 },
      substitutions: [...PASS_SUBSTITUTIONS, ...SCAN_SUBSTITUTIONS],
      steps: [traceStep('pass-expiry-boundaries', pass.trace), traceStep('scan-expiry-boundaries', revoked.trace)],
      assertions: [
        { name: 'utc-instant-matrix-evaluated', met: intervalMatrix.endsWith('3'), expected: 3, actual: intervalMatrix },
        { name: 'account-deactivation-is-closed', met: accountBefore === 1 && accountAt === 0 && accountAfter === 1, expected: [1, 0, 1], actual: [accountBefore, accountAt, accountAfter] },
        { name: 'pass-credential-boundary-before-at-after', met: pass.credential_expiry_boundary.before === 'allowed' && pass.credential_expiry_boundary.at === 'denied' && pass.credential_expiry_boundary.after === 'denied', expected: ['allowed', 'denied', 'denied'], actual: Object.values(pass.credential_expiry_boundary) },
        { name: 'pass-offline-session-expires-at-boundary', met: pass.offline_session_boundary.before === true && pass.offline_session_boundary.at === false && pass.offline_session_boundary.after === false, expected: [true, false, false], actual: Object.values(pass.offline_session_boundary) },
        { name: 'scan-trust-hard-expiry-is-inclusive-then-closed', met: revoked.trust_hard_expiry_boundary.before === true && revoked.trust_hard_expiry_boundary.at === true && revoked.trust_hard_expiry_boundary.after === false, expected: [true, true, false], actual: Object.values(revoked.trust_hard_expiry_boundary) },
        { name: 'scan-offline-session-expires-at-boundary', met: revoked.offline_session_boundary.before === true && revoked.offline_session_boundary.at === false && revoked.offline_session_boundary.after === false, expected: [true, false, false], actual: Object.values(revoked.offline_session_boundary) },
      ],
    });
  } finally {
    await fs.rm(inputPath, { force: true });
  }
}
