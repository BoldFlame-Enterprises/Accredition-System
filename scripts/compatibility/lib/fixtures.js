import { composeArgs, repoRoot } from './config.js';
import { applyConfirmedFixtureMutation } from './database.js';
import { runCommand } from './process.js';

export async function seedCompatibilityDatabase(context) {
  const result = await runCommand('docker', composeArgs(context, [
    'exec', '--no-TTY',
    '--env', 'NODE_ENV=development',
    '--env', 'ALLOW_DATABASE_SEED=true',
    '--env', `SEED_DATABASE_NAME_CONFIRMATION=${context.databaseName}`,
    'backend', 'node', 'dist/scripts/seed-database.js',
  ]), { cwd: repoRoot });
  if (!result.stdout.includes('Database seeding completed successfully')) {
    throw new Error('Disposable compatibility seed did not report completion');
  }
  // The development seed predates explicit enrollment states. Keep the
  // production seed untouched and adapt only this disposable fixture.
  await applyConfirmedFixtureMutation(context, {
    expectedDatabase: context.databaseName,
    reason: 'Activate disposable legacy seed identities for compatibility authentication',
    sql: "UPDATE users SET identity_status = 'active' WHERE email LIKE '%@test.com' AND is_active = true",
  });
}
