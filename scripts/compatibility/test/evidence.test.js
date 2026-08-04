import assert from 'node:assert/strict';
import test from 'node:test';
import { EVIDENCE_SCHEMA_VERSION, validateEvidence } from '../lib/evidence.js';

function manifest(result = 'passed') {
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
    steps: [{
      name: 'health',
      at: '2026-08-04T12:00:01.000Z',
      retry: 0,
      status: 200,
      outcome: 'healthy',
      request_id: 'request-1',
      correlation_id: 'operation-1',
    }],
    assertions: [{ name: 'healthy', met: result === 'passed' }],
    native_adapter_substitutions: [],
    result,
  };
}

test('accepts complete passed and failed evidence', () => {
  assert.equal(validateEvidence(manifest()).result, 'passed');
  assert.equal(validateEvidence(manifest('failed')).result, 'failed');
});

test('rejects a pass with unmet assertions or an unknown scenario', () => {
  const unmet = manifest();
  unmet.assertions[0].met = false;
  assert.throws(() => validateEvidence(unmet), /unmet assertion/);
  const unknown = manifest();
  unknown.scenario.id = '99';
  assert.throws(() => validateEvidence(unknown), /Unknown compatibility scenario/);
});

test('rejects tokens, private keys, and forbidden secret fields', () => {
  const token = manifest('failed');
  token.fixtures.value = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signaturevalue';
  assert.throws(() => validateEvidence(token), /secret pattern/);
  const key = manifest('failed');
  key.runtime.private_key = 'planted';
  assert.throws(() => validateEvidence(key), /Forbidden evidence key/);
});
