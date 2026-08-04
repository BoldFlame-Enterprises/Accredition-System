import fs from 'node:fs/promises';
import path from 'node:path';
import { assertRedactedText } from './evidence.js';
import { composeArgs, repoRoot } from './config.js';
import { runCommand } from './process.js';

export async function startStack(context) {
  await runCommand('docker', composeArgs(context, ['up', '--detach', '--build']), {
    cwd: repoRoot,
    inherit: true,
  });
  await waitForUrl(`${context.backendUrl}/ready`, 120_000);
  await waitForUrl(context.dashboardUrl, 60_000);
}

export async function waitForUrl(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
      if (response.ok) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? 'no response'}`);
}

export async function runBrowserSmoke(context) {
  await runCommand('npm', [
    'exec', '--', 'playwright', 'test',
    '--config', 'playwright.config.ts',
    'tests/compatibility/harness-smoke.spec.ts',
  ], {
    cwd: path.join(repoRoot, 'web-dashboard'),
    env: {
      ...process.env,
      COMPAT_BASE_URL: context.dashboardUrl,
      COMPAT_RUN_ID: context.runId,
      PLAYWRIGHT_HTML_REPORT: path.join(context.evidenceDirectory, 'playwright-report'),
      PLAYWRIGHT_OUTPUT_DIR: path.join(context.evidenceDirectory, 'playwright-output'),
    },
    inherit: true,
  });
}

export async function collectLogs(context) {
  const result = await runCommand('docker', composeArgs(context, ['logs', '--no-color', '--timestamps']), {
    cwd: repoRoot,
    allowFailure: true,
  });
  const logs = `${result.stdout}${result.stderr}`;
  assertRedactedText(logs, 'service logs');
  await fs.mkdir(context.evidenceDirectory, { recursive: true });
  await fs.writeFile(path.join(context.evidenceDirectory, 'services.log'), logs);
  return result.code;
}

export async function stopStack(context) {
  if (!context.projectName.startsWith('verigate-compat-')) {
    throw new Error('Refusing cleanup outside a compatibility project');
  }
  return runCommand('docker', composeArgs(context, [
    'down', '--volumes', '--remove-orphans', '--timeout', '10',
  ]), { cwd: repoRoot, allowFailure: true, inherit: true });
}
