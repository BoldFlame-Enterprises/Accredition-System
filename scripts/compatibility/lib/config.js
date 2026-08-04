import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from './process.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, '..', '..', '..');
export const stateRoot = path.join(repoRoot, '.compatibility');
export const artifactRoot = path.join(repoRoot, 'compatibility-artifacts');
export const composeFile = path.join(repoRoot, 'docker-compose.compatibility.yml');
export const RUN_ID_PATTERN = /^run-[0-9]{8}t[0-9]{6}z-[a-f0-9]{8}$/;

export function newRunId(now = new Date(), random = crypto.randomBytes(4).toString('hex')) {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z').toLowerCase();
  return `run-${stamp}-${random}`;
}

export function assertRunId(runId) {
  if (!RUN_ID_PATTERN.test(runId)) {
    throw new Error(`Unsafe compatibility run ID: ${runId}`);
  }
  return runId;
}

function randomSecret(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

function parseDotenv(output) {
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator > 0) values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  for (const key of [
    'QR_AUTHORITY_ACTIVE_KEY_ID',
    'QR_AUTHORITY_PRIVATE_KEY_BASE64',
    'QR_AUTHORITY_KEYRING_JSON',
  ]) {
    if (!values[key]) throw new Error(`QR generator did not emit ${key}`);
  }
  return values;
}

async function qrMaterial(runId) {
  const generated = await runCommand('npm', [
    '--prefix', 'backend', 'run', 'qr:authority:generate', '--',
    '--key-id', `compat-${runId.slice(-8)}`,
  ], { cwd: repoRoot });
  return parseDotenv(generated.stdout);
}

async function createDashboardBuildContext(runDirectory) {
  const target = path.join(runDirectory, 'dashboard-context');
  const archive = path.join(runDirectory, 'dashboard-context.tar');
  await fs.mkdir(target, { recursive: true });
  await runCommand('git', [
    '-C', 'web-dashboard', 'archive', '--format=tar', 'HEAD', '--output', archive,
  ], { cwd: repoRoot });
  await runCommand('tar', ['-xf', archive, '-C', target], { cwd: repoRoot });
  await fs.rm(archive, { force: true });
  return path.relative(repoRoot, target).replaceAll('\\', '/');
}

function dotenv(values) {
  return Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n';
}

export async function createRunContext(runId = newRunId()) {
  assertRunId(runId);
  const [backendPort, dashboardPort, qr] = await Promise.all([
    freePort(),
    freePort(),
    qrMaterial(runId),
  ]);
  const runDirectory = path.join(stateRoot, 'runs', runId);
  const evidenceDirectory = path.join(artifactRoot, runId);
  const envFile = path.join(runDirectory, 'compose.env');
  const stateFile = path.join(runDirectory, 'state.json');
  const projectName = `verigate-compat-${runId.slice(-8)}`;
  await fs.mkdir(runDirectory, { recursive: true });
  const dashboardBuildContext = await createDashboardBuildContext(runDirectory);
  const values = {
    COMPOSE_PROJECT_NAME: projectName,
    COMPAT_RUN_ID: runId,
    COMPAT_IMAGE_TAG: runId.slice(-8),
    COMPAT_DB_NAME: `verigate_compat_${runId.slice(-8)}`,
    COMPAT_DB_PASSWORD: randomSecret(32),
    COMPAT_BACKEND_PORT: String(backendPort),
    COMPAT_DASHBOARD_PORT: String(dashboardPort),
    COMPAT_DASHBOARD_CONTEXT: dashboardBuildContext,
    JWT_ACCOUNT_ACCESS_SECRET: randomSecret(),
    JWT_ACCOUNT_REFRESH_SECRET: randomSecret(),
    JWT_DEVICE_ACCESS_SECRET: randomSecret(),
    JWT_DEVICE_REFRESH_SECRET: randomSecret(),
    JWT_AUDIT_ACCESS_SECRET: randomSecret(),
    JWT_ISSUER: `verigate-compat-${runId.slice(-8)}`,
    AUTH_ABUSE_HMAC_SECRET: randomSecret(),
    ENCRYPTION_KEY: randomSecret(32),
    ...qr,
  };
  const context = {
    runId,
    projectName,
    databaseName: values.COMPAT_DB_NAME,
    databaseHost: 'postgres',
    backendPort,
    dashboardPort,
    backendUrl: `http://127.0.0.1:${backendPort}`,
    dashboardUrl: `http://127.0.0.1:${dashboardPort}`,
    runDirectory,
    evidenceDirectory,
    envFile,
    stateFile,
  };
  await fs.mkdir(evidenceDirectory, { recursive: true });
  await fs.writeFile(envFile, dotenv(values), { mode: 0o600 });
  await fs.writeFile(stateFile, JSON.stringify(context, null, 2) + '\n');
  await fs.mkdir(stateRoot, { recursive: true });
  await fs.writeFile(path.join(stateRoot, 'current.json'), JSON.stringify({ runId }) + '\n');
  return context;
}

export async function loadRunContext(requestedRunId) {
  let runId = requestedRunId;
  if (!runId) {
    const current = JSON.parse(await fs.readFile(path.join(stateRoot, 'current.json'), 'utf8'));
    runId = current.runId;
  }
  assertRunId(runId);
  const stateFile = path.join(stateRoot, 'runs', runId, 'state.json');
  const context = JSON.parse(await fs.readFile(stateFile, 'utf8'));
  if (context.runId !== runId || context.projectName !== `verigate-compat-${runId.slice(-8)}`) {
    throw new Error('Compatibility run state failed exact identity validation');
  }
  return context;
}

export function composeArgs(context, args) {
  assertRunId(context.runId);
  if (!context.projectName.startsWith('verigate-compat-')) {
    throw new Error('Refusing Docker operation outside a compatibility project');
  }
  return [
    'compose', '--project-name', context.projectName,
    '--env-file', context.envFile,
    '--file', composeFile,
    ...args,
  ];
}

export async function removeSecretEnvironment(context) {
  await fs.rm(context.envFile, { force: true });
}
