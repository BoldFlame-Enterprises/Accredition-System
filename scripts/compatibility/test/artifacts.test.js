import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  EVIDENCE_SCHEMA_VERSION,
  validateEvidenceArtifacts,
  writeEvidence,
} from '../lib/evidence.js';

function manifest() {
  return {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    scenario: {
      id: '00',
      name: 'harness-smoke',
      started_at: '2026-08-04T12:00:00.000Z',
      ended_at: '2026-08-04T12:00:01.000Z',
    },
    run: { id: 'run-20260804t120000z-00000001' },
    repositories: { parent: 'abc123' },
    runtime: { node: 'v22.14.0' },
    fixtures: { namespace: 'fixture-1' },
    steps: [{ name: 'health', at: '2026-08-04T12:00:01.000Z', retry: 0, status: 200 }],
    assertions: [{ name: 'healthy', met: true }],
    native_adapter_substitutions: [],
    result: 'passed',
  };
}

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'verigate-evidence-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await writeEvidence(directory, manifest());
  await fs.writeFile(path.join(directory, 'services.log'), 'redacted service output\n');
  return directory;
}

test('verifies the exact scenario set, manifests, and hash sidecars', async (t) => {
  const directory = await fixture(t);
  const result = await validateEvidenceArtifacts(directory, { expectedScenarioIds: ['00'] });
  assert.deepEqual(result.scenarios, ['00']);

  await fs.writeFile(path.join(directory, '00-harness-smoke.json.sha256'), '0'.repeat(64));
  await assert.rejects(validateEvidenceArtifacts(directory), /hash mismatch/);
});

test('rejects generated secret values copied into uploadable artifacts', async (t) => {
  const directory = await fixture(t);
  const planted = 'generated-secret-value-for-test';
  await fs.writeFile(path.join(directory, 'browser.txt'), `diagnostic=${planted}\n`);
  await assert.rejects(
    validateEvidenceArtifacts(directory, { sensitiveValues: [planted] }),
    /Generated secret value detected/
  );
});
