import fs from 'node:fs/promises';
import path from 'node:path';
import { composeArgs, repoRoot } from './config.js';
import { runCommand } from './process.js';

async function requirePath(relativePath) {
  await fs.access(path.join(repoRoot, relativePath));
}

export async function preflight(context) {
  if (Number(process.versions.node.split('.')[0]) !== 22) {
    throw new Error(`Compatibility harness requires Node 22; found ${process.version}`);
  }
  if (context.databaseHost !== 'postgres' || !context.databaseName.startsWith('verigate_compat_')) {
    throw new Error('Refusing a non-isolated compatibility database target');
  }
  await Promise.all([
    requirePath('backend/package.json'),
    requirePath('web-dashboard/package.json'),
    requirePath('verigate-pass/package.json'),
    requirePath('verigate-scan/package.json'),
    requirePath('web-dashboard/node_modules/@playwright/test/package.json'),
  ]);
  await runCommand('docker', ['version', '--format', '{{.Server.Version}}'], { cwd: repoRoot });
  await runCommand('docker', ['compose', 'version'], { cwd: repoRoot });
  await runCommand('npm', [
    'exec', '--', 'node', '-e',
    "const fs=require('node:fs');const {chromium}=require('@playwright/test');fs.accessSync(chromium.executablePath())",
  ], { cwd: path.join(repoRoot, 'web-dashboard') });
  await runCommand('npm', [
    '--prefix', 'backend', 'run', 'qr:authority:validate',
  ], {
    cwd: repoRoot,
    env: { ...process.env, ...await environmentFromFile(context.envFile) },
  });
  await runCommand('docker', composeArgs(context, ['config', '--quiet']), { cwd: repoRoot });
  return context;
}

async function environmentFromFile(file) {
  const values = {};
  for (const line of (await fs.readFile(file, 'utf8')).split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator > 0) values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return values;
}
