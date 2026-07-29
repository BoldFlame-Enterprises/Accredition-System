const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const mutations = [
  ['malformed-json', 'replace-encoded:{', 'deny', 'malformed_schema'],
  ['wrong-types', 'set:v:3', 'deny', 'malformed_schema'],
  ['missing-field', 'delete:c.p.cid', 'deny', 'malformed_schema'],
  ['unknown-field', 'set:x:true', 'deny', 'malformed_schema'],
  ['oversized-payload', 'set:c.p.did:256', 'deny', 'payload_too_large'],
  ['wrong-event', 'set:c.p.eid:5', 'deny', 'wrong_event'],
  ['authority-signature-mutation', 'flip-byte:c.s:0', 'deny', 'invalid_authority_signature'],
  ['device-signature-mutation', 'flip-byte:s:0', 'deny', 'invalid_device_signature'],
  ['wrong-curve', 'replace-key:c.p.dpk:P-384', 'deny', 'invalid_device_key'],
  ['wrong-key-length', 'truncate-byte:c.p.dpk', 'deny', 'invalid_device_key'],
  ['credential-expired-minus-one', 'verify-at:1785427261', 'deny', 'credential_expired'],
  ['credential-expired-boundary', 'verify-at:1785427260', 'allow', 'valid'],
  ['credential-future-plus-one', 'set:c.p.iat:1785340861', 'deny', 'credential_not_yet_valid'],
  ['credential-future-boundary', 'set:c.p.iat:1785340860', 'allow_after_resign', 'valid'],
  ['presentation-expired-plus-one', 'verify-at:1785340921', 'deny', 'presentation_expired'],
  ['presentation-expired-boundary', 'verify-at:1785340920', 'allow', 'valid'],
  ['inverted-credential-interval', 'set:c.p.exp:1785340799', 'deny', 'invalid_interval'],
  ['inverted-presentation-interval', 'set:exp:1785340799', 'deny', 'invalid_interval'],
  ['revoked-credential-generation', 'set-trust:credential_generation:13', 'deny', 'credential_revoked'],
  ['revoked-device-generation', 'set-trust:registration_generation:4', 'deny', 'device_revoked'],
  ['unknown-key-id', 'set:c.p.kid:qr-unknown', 'deny', 'unknown_authority_key'],
  ['repeated-nonce', 'verify-twice:n', 'allow_and_correlate', 'repeated_presentation'],
  ['v2-parser-separation', 'replace-version:verigate-qr-v2', 'route_to_v2_only', 'unsupported_protocol'],
].map(([id, change, decision, code]) => ({ id, change, decision, code }));

const credentialPayload = {
  v: 3,
  kid: 'qr-2026-01',
  cid: 'ABEiM0RVZneImaq7zN3u_w',
  cg: 12,
  uid: 7,
  eid: 4,
  did: 'pass-550e8400-e29b-41d4-a716-446655440000',
  rg: 3,
  dpk: 'BHzyexiNA09-ilI4AwS1GsPAiWnid_IbNaYLSPxHZpl4B3dVENuO0EApPZrGn3Qw27p9reY86YIpngS3nSJ4c9E',
  iat: 1785340800,
  exp: 1785427200,
};
const authoritySignature = 'mTeiXhMIQNnstAExz6UG3CSyvrSnIkZuojC9Z2HylyUGkHy8PmTW43WZI7zJf8jP2I3B8Uj6TsdIXrspVX8oAw';
const presentationUnsigned = {
  v: 3,
  c: { p: credentialPayload, s: authoritySignature },
  iat: 1785340800,
  exp: 1785340860,
  n: 'AAECAwQFBgcICQoLDA0ODw',
};
const fixture = {
  contract: 'verigate-qr-v3',
  canonicalization: 'recursive-key-sorted-json-utf8',
  signature: 'P-256/SHA-256/IEEE-P1363',
  limits: {
    encoded_utf8_bytes: 800,
    presentation_lifetime_seconds: 60,
    clock_skew_seconds: 60,
    nonce_bytes: 16,
    credential_id_bytes: 16,
    public_key_bytes: 65,
    signature_bytes: 64,
    kid_max_chars: 32,
    device_id_max_chars: 64,
  },
  verification: {
    now: 1785340800,
    expected_event_id: 4,
    authority_public_key: 'BGsX0fLhLEJH-Lzm5WOkQPJ3A32BLeszoPShOUXYmMKWT-NC4v4af5uO5-tKfA-eFivOM1drMV7Oy7ZAaDe_UfU',
    device_public_key: credentialPayload.dpk,
  },
  valid: {
    credential_payload: credentialPayload,
    credential_sha256: 'f44dfbb06ad209bf0b2033ad87da7d135183a199298d6dc3b1abd83fb2f50da2',
    authority_signature: authoritySignature,
    presentation_unsigned: presentationUnsigned,
    presentation_sha256: 'e8339990283db13855324b1e621fe290135e0fc82080d53da8c510af0aa31efc',
    device_signature: 'PMvRIiwja2e00OEgOmHf2KBHFDOefmIYK5w1sEi_v25rdKARAn-hkpId95bZB3QZFgB8rNYhuKHiQE98jV-RfQ',
    encoded_utf8_bytes: 535,
  },
  mutations,
};

const expected = `${JSON.stringify(fixture, null, 2)}\n`;
const expectedSha256 = 'e94495edcee2c7954096a9e6e70f5281299e178fb4ac479bba06593d383427cf';
const fixturePaths = [
  'backend/server/services/__fixtures__/qr-v3-contract.json',
  'verigate-pass/src/services/__fixtures__/qr-v3-contract.json',
  'verigate-scan/src/services/__fixtures__/qr-v3-contract.json',
].map((relative) => path.join(__dirname, '..', relative));

if (process.argv.includes('--write')) {
  for (const fixturePath of fixturePaths) {
    fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
    fs.writeFileSync(fixturePath, expected, 'utf8');
  }
}

for (const fixturePath of fixturePaths) {
  if (!fs.existsSync(fixturePath) || fs.readFileSync(fixturePath, 'utf8') !== expected) {
    throw new Error(`QR contract fixture differs from the pinned source: ${fixturePath}`);
  }
}
const actualSha256 = crypto.createHash('sha256').update(expected).digest('hex');
if (actualSha256 !== expectedSha256) {
  throw new Error(`QR contract fixture checksum changed: ${actualSha256}`);
}
console.log(`Verified 3 identical QR contract fixtures (${actualSha256})`);
