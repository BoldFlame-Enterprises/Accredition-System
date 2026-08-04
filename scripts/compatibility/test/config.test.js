import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRunId, composeArgs, newRunId } from '../lib/config.js';

test('creates bounded unique run IDs', () => {
  const first = newRunId(new Date('2026-08-04T12:34:56Z'), '00000001');
  const second = newRunId(new Date('2026-08-04T12:34:56Z'), '00000002');
  assert.equal(first, 'run-20260804t123456z-00000001');
  assert.notEqual(first, second);
  assert.equal(assertRunId(first), first);
});

test('cleanup arguments are tied to one validated compatibility project', () => {
  const context = {
    runId: 'run-20260804t123456z-00000001',
    projectName: 'verigate-compat-00000001',
    envFile: 'ignored.env',
  };
  const args = composeArgs(context, ['down', '--volumes']);
  assert.deepEqual(args.slice(0, 4), [
    'compose', '--project-name', 'verigate-compat-00000001', '--env-file',
  ]);
  assert.ok(args.some((value) => value.endsWith('docker-compose.compatibility.yml')));
  assert.throws(() => composeArgs({ ...context, projectName: 'ordinary-root' }, ['down']), /Refusing/);
  assert.throws(() => assertRunId('../../unsafe'), /Unsafe/);
});
