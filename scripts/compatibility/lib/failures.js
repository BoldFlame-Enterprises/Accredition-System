import { composeArgs, repoRoot } from './config.js';
import { runCommand } from './process.js';

const CONTROLLABLE_SERVICES = new Set(['backend', 'redis', 'web-dashboard']);

export function assertControllableService(service) {
  if (!CONTROLLABLE_SERVICES.has(service)) {
    throw new Error(`Refusing compatibility failure control for ${service}`);
  }
  return service;
}

export async function stopCompatibilityService(context, service) {
  assertControllableService(service);
  await runCommand('docker', composeArgs(context, ['stop', '--timeout', '10', service]), {
    cwd: repoRoot,
  });
}

export async function startCompatibilityService(context, service) {
  assertControllableService(service);
  await runCommand('docker', composeArgs(context, ['start', service]), { cwd: repoRoot });
}
