import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCompatibilityDatabase } from '../lib/database.js';
import { assertControllableService } from '../lib/failures.js';

const context = {
  databaseHost: 'postgres',
  databaseName: 'verigate_compat_00000001',
};

test('requires exact isolated database confirmation', () => {
  assert.doesNotThrow(() => assertCompatibilityDatabase(context, 'verigate_compat_00000001'));
  assert.throws(() => assertCompatibilityDatabase(context, 'postgres'), /did not match/);
  assert.throws(() => assertCompatibilityDatabase({ ...context, databaseHost: 'hosted.example' }, context.databaseName), /did not match/);
});

test('failure controls can address only declared compatibility services', () => {
  assert.equal(assertControllableService('redis'), 'redis');
  assert.throws(() => assertControllableService('postgres'), /Refusing/);
  assert.throws(() => assertControllableService('unrelated-service'), /Refusing/);
});
