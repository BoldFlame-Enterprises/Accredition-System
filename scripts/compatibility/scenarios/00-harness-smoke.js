import { runCommand } from '../lib/process.js';
import { EVIDENCE_SCHEMA_VERSION, writeEvidence } from '../lib/evidence.js';
import { repoRoot } from '../lib/config.js';

async function revision(relativePath = '.') {
  return (await runCommand('git', ['-C', relativePath, 'rev-parse', 'HEAD'], { cwd: repoRoot })).stdout.trim();
}

export async function runHarnessSmoke(context, options = {}) {
  const startedAt = new Date().toISOString();
  const correlationId = `smoke.${context.runId.slice(-8)}`;
  const response = await fetch(`${context.backendUrl}/health`, {
    headers: { 'X-Correlation-Id': correlationId },
    signal: AbortSignal.timeout(5_000),
  });
  const body = await response.json();
  const healthy = response.status === 200 && body?.status === 'healthy';
  const assertionMet = healthy && !options.injectAssertionFailure;
  const endedAt = new Date().toISOString();
  const manifest = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    scenario: {
      id: '00',
      name: 'harness-smoke',
      started_at: startedAt,
      ended_at: endedAt,
    },
    run: { id: context.runId },
    repositories: {
      parent: await revision('.'),
      backend: await revision('backend'),
      dashboard: await revision('web-dashboard'),
      pass: await revision('verigate-pass'),
      scan: await revision('verigate-scan'),
    },
    runtime: {
      node: process.version,
      dashboard_url: context.dashboardUrl,
      backend_url: context.backendUrl,
    },
    fixtures: { namespace: context.runId },
    steps: [{
      name: 'backend-health',
      at: endedAt,
      retry: 0,
      status: response.status,
      outcome: assertionMet ? 'healthy' : options.injectAssertionFailure ? 'injected-failure' : 'unhealthy',
      request_id: response.headers.get('x-request-id') ?? undefined,
      correlation_id: response.headers.get('x-correlation-id') ?? correlationId,
    }],
    assertions: [{
      name: 'backend-health-is-successful',
      met: assertionMet,
      expected: { status: 200, health: 'healthy' },
      actual: { status: response.status, health: body?.status },
    }],
    native_adapter_substitutions: [],
    result: assertionMet ? 'passed' : 'failed',
  };
  const evidence = await writeEvidence(context.evidenceDirectory, manifest);
  if (!assertionMet) throw new Error(`Injected smoke assertion failed; evidence: ${evidence.file}`);
  return evidence;
}
