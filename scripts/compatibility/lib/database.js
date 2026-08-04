import crypto from 'node:crypto';
import { composeArgs, repoRoot } from './config.js';
import { runCommand } from './process.js';

export function assertCompatibilityDatabase(context, expectedDatabase) {
  if (
    context.databaseHost !== 'postgres'
    || !context.databaseName.startsWith('verigate_compat_')
    || expectedDatabase !== context.databaseName
  ) {
    throw new Error('Compatibility database confirmation did not match the isolated target');
  }
}

function oneStatement(sql) {
  const value = String(sql).trim();
  const withoutFinalTerminator = value.endsWith(';') ? value.slice(0, -1) : value;
  if (!withoutFinalTerminator || withoutFinalTerminator.includes(';')) {
    throw new Error('Compatibility SQL must contain exactly one statement');
  }
  return withoutFinalTerminator;
}

export async function queryCompatibilityDatabase(context, sql) {
  const statement = oneStatement(sql);
  if (!/^(?:select|with)\b/i.test(statement)) {
    throw new Error('Database assertions must be read-only SELECT/WITH statements');
  }
  assertCompatibilityDatabase(context, context.databaseName);
  const result = await runCommand('docker', composeArgs(context, [
    'exec', '--no-TTY', 'postgres', 'psql',
    '--username', 'postgres', '--dbname', context.databaseName,
    '--set', 'ON_ERROR_STOP=1', '--csv', '--command', statement,
  ]), { cwd: repoRoot });
  return result.stdout;
}

export async function applyConfirmedFixtureMutation(context, options) {
  assertCompatibilityDatabase(context, options.expectedDatabase);
  if (!options.reason?.trim()) throw new Error('Direct fixture mutation requires an evidence reason');
  const statement = oneStatement(options.sql);
  const result = await runCommand('docker', composeArgs(context, [
    'exec', '--no-TTY', 'postgres', 'psql',
    '--username', 'postgres', '--dbname', context.databaseName,
    '--set', 'ON_ERROR_STOP=1', '--command', statement,
  ]), { cwd: repoRoot });
  return {
    reason: options.reason,
    statement_sha256: crypto.createHash('sha256').update(statement).digest('hex'),
    output: result.stdout,
  };
}
