import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const EVIDENCE_SCHEMA_VERSION = 'verigate.compatibility.evidence.v1';
const SAFE_ID = /^[A-Za-z0-9._:-]{1,64}$/;
const SCENARIOS = new Set(['00', ...Array.from({ length: 13 }, (_, index) => String(index + 1).padStart(2, '0'))]);
const FORBIDDEN_KEYS = /(?:password|secret|private.?key|access.?token|refresh.?token|authorization|cookie)/i;
const FORBIDDEN_VALUES = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bBearer\s+[A-Za-z0-9._~-]+/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /QR_AUTHORITY_PRIVATE_KEY_BASE64=/,
];

function isUtcTimestamp(value) {
  return typeof value === 'string' && value.endsWith('Z') && Number.isFinite(Date.parse(value));
}

function scanSecrets(value, location = '$') {
  if (typeof value === 'string') {
    for (const pattern of FORBIDDEN_VALUES) {
      if (pattern.test(value)) throw new Error(`Evidence secret pattern detected at ${location}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanSecrets(entry, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.test(key)) throw new Error(`Forbidden evidence key at ${location}.${key}`);
      scanSecrets(entry, `${location}.${key}`);
    }
  }
}

export function validateEvidence(manifest) {
  const allowed = new Set([
    'schema_version', 'scenario', 'run', 'repositories', 'runtime', 'fixtures',
    'steps', 'assertions', 'native_adapter_substitutions', 'result',
  ]);
  for (const key of Object.keys(manifest)) {
    if (!allowed.has(key)) throw new Error(`Unknown evidence property: ${key}`);
  }
  if (manifest.schema_version !== EVIDENCE_SCHEMA_VERSION) throw new Error('Unsupported evidence schema');
  if (!SCENARIOS.has(manifest.scenario?.id)) throw new Error('Unknown compatibility scenario');
  if (!manifest.scenario?.name || !isUtcTimestamp(manifest.scenario.started_at)
    || !isUtcTimestamp(manifest.scenario.ended_at)) throw new Error('Invalid scenario metadata');
  if (!SAFE_ID.test(manifest.run?.id ?? '')) throw new Error('Invalid evidence run ID');
  if (!Array.isArray(manifest.steps) || manifest.steps.length === 0) throw new Error('Evidence has no steps');
  for (const [index, step] of manifest.steps.entries()) {
    if (!step.name || !isUtcTimestamp(step.at) || !Number.isInteger(step.retry) || step.retry < 0) {
      throw new Error(`Invalid evidence step ${index}`);
    }
    if (step.request_id != null && !SAFE_ID.test(step.request_id)) throw new Error(`Unsafe request ID at step ${index}`);
    if (step.correlation_id != null && !SAFE_ID.test(step.correlation_id)) throw new Error(`Unsafe correlation ID at step ${index}`);
  }
  if (!Array.isArray(manifest.assertions) || manifest.assertions.length === 0) {
    throw new Error('Evidence has no assertions');
  }
  if (!['passed', 'failed', 'blocked'].includes(manifest.result)) throw new Error('Invalid evidence result');
  if (manifest.result === 'passed' && manifest.assertions.some((assertion) => assertion.met !== true)) {
    throw new Error('Passed evidence contains an unmet assertion');
  }
  if (!Array.isArray(manifest.native_adapter_substitutions)) {
    throw new Error('Evidence must declare native adapter substitutions');
  }
  scanSecrets(manifest);
  return manifest;
}

export async function writeEvidence(directory, manifest) {
  validateEvidence(manifest);
  await fs.mkdir(directory, { recursive: true });
  const file = path.join(directory, `${manifest.scenario.id}-${manifest.scenario.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`);
  const encoded = JSON.stringify(manifest, null, 2) + '\n';
  await fs.writeFile(file, encoded);
  const digest = crypto.createHash('sha256').update(encoded).digest('hex');
  await fs.writeFile(`${file}.sha256`, `${digest}  ${path.basename(file)}\n`);
  return { file, digest };
}

export function assertRedactedText(text, label) {
  scanSecrets(String(text), label);
}
