import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { queryCompatibilityDatabase } from '../lib/database.js';
import { EVIDENCE_SCHEMA_VERSION, writeEvidence } from '../lib/evidence.js';
import { seedCompatibilityDatabase } from '../lib/fixtures.js';
import { repoRoot } from '../lib/config.js';
import { runCommand } from '../lib/process.js';
import { runDashboardDomainSetup } from '../lib/runtime.js';

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

async function repositoryRevisions() {
  return {
    parent: await revision('.'),
    backend: await revision('backend'),
    dashboard: await revision('web-dashboard'),
    pass: await revision('verigate-pass'),
    scan: await revision('verigate-scan'),
  };
}

function numeric(value, label) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`Invalid ${label}`);
  return number;
}

function uuid(value, label) {
  if (!/^[0-9a-f-]{36}$/i.test(String(value))) throw new Error(`Invalid ${label}`);
  return String(value);
}

function csvCount(output) {
  const lines = output.trim().split(/\r?\n/);
  const value = Number(lines.at(-1));
  if (!Number.isSafeInteger(value)) throw new Error(`Unexpected database assertion output: ${output}`);
  return value;
}

function traceStep(name, trace) {
  return {
    name,
    request_id: trace?.requestId,
    correlation_id: trace?.correlationId,
  };
}

async function evidence(context, repositories, input) {
  const now = new Date().toISOString();
  return writeEvidence(context.evidenceDirectory, {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    scenario: {
      id: input.id,
      name: input.name,
      started_at: input.startedAt ?? now,
      ended_at: now,
    },
    run: { id: context.runId },
    repositories,
    runtime: { node: process.version, database: 'PostgreSQL 17', cache: 'Redis 7' },
    fixtures: input.fixtures,
    steps: input.steps.map((step, index) => ({
      at: now,
      retry: 0,
      status: 200,
      outcome: 'completed',
      ...step,
      name: step.name ?? `step-${index + 1}`,
    })),
    assertions: input.assertions,
    native_adapter_substitutions: input.substitutions ?? [],
    result: input.assertions.every((assertion) => assertion.met) ? 'passed' : 'failed',
  });
}

async function runMobileFlow(context, fixture, passOutput, scanOutput) {
  const common = {
    ...process.env,
    COMPAT_LIVE: '1',
    COMPAT_BACKEND_URL: `${context.backendUrl}/api`,
    COMPAT_EVENT_ID: String(fixture.event_id),
  };
  await runCommand('npm', ['test', '--', '--runInBand', 'compatibility/live-flow.test.ts'], {
    cwd: path.join(repoRoot, 'verigate-pass'),
    env: { ...common, COMPAT_PASS_OUTPUT: passOutput },
  });
  await runCommand('npm', ['test', '--', '--runInBand', 'compatibility/live-flow.test.ts'], {
    cwd: path.join(repoRoot, 'verigate-scan'),
    env: {
      ...common,
      COMPAT_PASS_OUTPUT: passOutput,
      COMPAT_SCAN_OUTPUT: scanOutput,
      COMPAT_AUTHORIZED_AREA_ID: String(fixture.authorized_area_id),
      COMPAT_DENIED_AREA_ID: String(fixture.denied_area_id),
    },
  });
}

export async function runIdentityScenarios(context) {
  const fixtureOutput = path.join(context.runDirectory, 'identity-fixture.json');
  const passOutput = path.join(context.runDirectory, 'pass-transient.json');
  const scanOutput = path.join(context.runDirectory, 'scan-summary.json');
  const startedAt = new Date().toISOString();
  await seedCompatibilityDatabase(context);
  await runDashboardDomainSetup(context, fixtureOutput);
  const fixture = JSON.parse(await fs.readFile(fixtureOutput, 'utf8'));
  for (const [key, label] of [
    ['event_id', 'event ID'], ['other_event_id', 'other event ID'],
    ['attendee_user_id', 'attendee user ID'], ['scanner_user_id', 'scanner user ID'],
    ['authorized_area_id', 'authorized area ID'], ['denied_area_id', 'denied area ID'],
    ['assignment_id', 'assignment ID'],
  ]) numeric(fixture[key], label);

  await runMobileFlow(context, fixture, passOutput, scanOutput);
  const pass = JSON.parse(await fs.readFile(passOutput, 'utf8'));
  const scan = JSON.parse(await fs.readFile(scanOutput, 'utf8'));
  await fs.rm(passOutput, { force: true });
  const repositories = await repositoryRevisions();
  const eventCount = csvCount(await queryCompatibilityDatabase(
    context,
    `SELECT COUNT(*) FROM events WHERE id = ${numeric(fixture.event_id, 'event ID')}`
  ));
  const assignmentCount = csvCount(await queryCompatibilityDatabase(
    context,
    `SELECT COUNT(*) FROM access_assignments WHERE id = ${numeric(fixture.assignment_id, 'assignment ID')}`
  ));
  const grantRecord = uuid(scan.grant_record_id, 'grant record ID');
  const denialRecord = uuid(scan.denial_record_id, 'denial record ID');
  const fallbackRecord = uuid(scan.fallback.record_id, 'fallback record ID');
  const persistedDecisions = csvCount(await queryCompatibilityDatabase(
    context,
    `SELECT COUNT(*) FROM scan_logs WHERE device_scan_id IN ('${grantRecord}', '${denialRecord}', '${fallbackRecord}')`
  ));
  const dashboardTrace = fixture.traces.at(-1);
  const commonFixtures = {
    namespace: context.runId,
    event_id: fixture.event_id,
    attendee_user_id: fixture.attendee_user_id,
  };

  await evidence(context, repositories, {
    id: '01', name: 'administrative-domain-setup', startedAt,
    fixtures: {
      ...commonFixtures,
      created_user_id: fixture.created_user_id,
      access_level_id: fixture.access_level_id,
      authorized_area_id: fixture.authorized_area_id,
      denied_area_id: fixture.denied_area_id,
    },
    steps: [{
      name: 'dashboard-create-and-reread',
      status: dashboardTrace.status,
      request_id: dashboardTrace.request_id,
      correlation_id: dashboardTrace.correlation_id,
    }],
    assertions: [
      { name: 'event-row-exists', met: eventCount === 1, expected: 1, actual: eventCount },
      { name: 'assignment-row-exists', met: assignmentCount === 1, expected: 1, actual: assignmentCount },
      { name: 'cross-event-assignment-rejected', met: fixture.cross_event_status === 400, expected: 400, actual: fixture.cross_event_status },
      { name: 'api-reread-agrees', met: fixture.reread_success === true, expected: true, actual: fixture.reread_success },
    ],
  });
  await evidence(context, repositories, {
    id: '02', name: 'pass-authentication-and-synchronization', startedAt,
    fixtures: commonFixtures,
    substitutions: PASS_SUBSTITUTIONS,
    steps: [traceStep('pass-production-client-sync', pass.trace)],
    assertions: [
      { name: 'event-user-v3-projection', met: pass.projection_contract === 'event-user-v3', expected: 'event-user-v3', actual: pass.projection_contract },
      { name: 'event-bound-registration', met: pass.event_id === fixture.event_id, expected: fixture.event_id, actual: pass.event_id },
    ],
  });
  const presentationHash = crypto.createHash('sha256').update(pass.presentation).digest('hex');
  await evidence(context, repositories, {
    id: '03', name: 'pass-v3-presentation', startedAt,
    fixtures: { ...commonFixtures, presentation_sha256: presentationHash },
    substitutions: PASS_SUBSTITUTIONS,
    steps: [traceStep('pass-production-presentation', pass.trace)],
    assertions: [
      { name: 'presentation-bounded', met: pass.presentation_bytes <= 800, expected_max: 800, actual: pass.presentation_bytes },
      { name: 'qr-version-supported', met: pass.qr_version <= 20, expected_max: 20, actual: pass.qr_version },
    ],
  });
  await evidence(context, repositories, {
    id: '04', name: 'scan-offline-grant', startedAt,
    fixtures: { ...commonFixtures, area_id: fixture.authorized_area_id, client_record_id: grantRecord },
    substitutions: SCAN_SUBSTITUTIONS,
    steps: [traceStep('scan-production-offline-verification', scan.trace)],
    assertions: [
      { name: 'credential-valid', met: scan.verification.valid === true, expected: true, actual: scan.verification.valid },
      { name: 'assignment-grants-area', met: scan.grant.granted === true, expected: true, actual: scan.grant.granted },
    ],
  });
  await evidence(context, repositories, {
    id: '05', name: 'scan-unauthorized-area-denial', startedAt,
    fixtures: { ...commonFixtures, area_id: fixture.denied_area_id, client_record_id: denialRecord },
    substitutions: SCAN_SUBSTITUTIONS,
    steps: [traceStep('scan-production-offline-denial', scan.trace)],
    assertions: [
      { name: 'unassigned-area-denied', met: scan.denial.granted === false, expected: false, actual: scan.denial.granted },
      { name: 'denial-is-not-signature-failure', met: scan.denial.code === 'manual_assignment_missing', expected: 'manual_assignment_missing', actual: scan.denial.code },
    ],
  });
  await evidence(context, repositories, {
    id: '06', name: 'typed-inconclusive-server-fallback', startedAt,
    fixtures: { ...commonFixtures, area_id: fixture.authorized_area_id, client_record_id: fallbackRecord },
    substitutions: SCAN_SUBSTITUTIONS,
    steps: [traceStep('scan-production-authenticated-fallback', scan.trace)],
    assertions: [
      { name: 'local-state-inconclusive', met: scan.inconclusive.conclusive === false, expected: false, actual: scan.inconclusive.conclusive },
      { name: 'fallback-grants-authorized-area', met: scan.fallback.access_granted === true, expected: true, actual: scan.fallback.access_granted },
      { name: 'three-decisions-persisted', met: persistedDecisions === 3, expected: 3, actual: persistedDecisions },
    ],
  });
  return { fixture, scan };
}
