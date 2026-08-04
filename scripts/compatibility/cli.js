#!/usr/bin/env node
import fs from 'node:fs/promises';
import {
  createRunContext,
  loadRunContext,
  removeSecretEnvironment,
} from './lib/config.js';
import { preflight } from './lib/preflight.js';
import { validateEvidenceArtifacts } from './lib/evidence.js';
import { collectLogs, runBrowserSmoke, startStack, stopStack } from './lib/runtime.js';
import { runHarnessSmoke } from './scenarios/00-harness-smoke.js';
import { runConvergenceScenarios } from './scenarios/convergence.js';
import { runIdentityScenarios } from './scenarios/identity.js';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function has(name) {
  return process.argv.includes(name);
}

async function commandContext(command) {
  if (command === 'run' || command === 'up' || command === 'preflight') {
    return createRunContext(option('--run-id'));
  }
  return loadRunContext(option('--run-id'));
}

async function main() {
  const command = process.argv[2];
  if (!['preflight', 'up', 'run', 'collect', 'verify', 'down'].includes(command)) {
    throw new Error('Usage: cli.js <preflight|up|run|collect|verify|down> [--run-id ID]');
  }
  const context = await commandContext(command);
  if (command === 'preflight') {
    try {
      await preflight(context);
      process.stdout.write(`Preflight passed for ${context.runId}\n`);
    } finally {
      await removeSecretEnvironment(context);
    }
    return;
  }
  if (command === 'up') {
    await preflight(context);
    await startStack(context);
    process.stdout.write(`Compatibility stack ready: ${context.runId}\n`);
    return;
  }
  if (command === 'collect') {
    await collectLogs(context);
    process.stdout.write(`Evidence collected: ${context.evidenceDirectory}\n`);
    return;
  }
  if (command === 'verify') {
    const verified = await validateEvidenceArtifacts(context.evidenceDirectory);
    process.stdout.write(`Evidence verified: ${verified.runId} (${verified.scenarios.length} scenarios)\n`);
    return;
  }
  if (command === 'down') {
    await collectLogs(context).catch(() => undefined);
    const cleanup = await stopStack(context);
    if (cleanup.code !== 0) {
      throw cleanup.error ?? new Error('Compatibility cleanup failed; run state was retained for retry');
    }
    await removeSecretEnvironment(context);
    process.stdout.write(`Compatibility stack removed: ${context.runId}\n`);
    return;
  }

  let failure;
  const scenarioGroup = option('--scenario-group');
  try {
    await preflight(context);
    await startStack(context);
    await runHarnessSmoke(context, { injectAssertionFailure: has('--inject-assertion-failure') });
    if (!has('--skip-browser')) await runBrowserSmoke(context);
    if (scenarioGroup === 'identity') await runIdentityScenarios(context);
    if (scenarioGroup === 'convergence') {
      const identity = await runIdentityScenarios(context);
      await runConvergenceScenarios(context, identity);
    }
  } catch (error) {
    failure = error;
  } finally {
    await collectLogs(context).catch((error) => {
      failure ??= error;
    });
    const cleanup = await stopStack(context).catch((error) => ({ code: 1, error }));
    if (cleanup.code !== 0) failure ??= cleanup.error ?? new Error('Compatibility cleanup failed');
    if (cleanup.code === 0 && !failure) {
      const expectedScenarioIds = scenarioGroup === 'convergence'
        ? ['00', ...Array.from({ length: 13 }, (_, index) => String(index + 1).padStart(2, '0'))]
        : scenarioGroup === 'identity'
          ? ['00', '01', '02', '03', '04', '05', '06']
          : ['00'];
      const environment = await fs.readFile(context.envFile, 'utf8');
      const sensitiveValues = environment.split(/\r?\n/)
        .filter((line) => /(?:PASSWORD|SECRET|PRIVATE_KEY|ENCRYPTION_KEY)=/.test(line))
        .map((line) => line.slice(line.indexOf('=') + 1));
      await validateEvidenceArtifacts(context.evidenceDirectory, { expectedScenarioIds, sensitiveValues })
        .catch((error) => { failure ??= error; });
    }
    if (cleanup.code === 0) await removeSecretEnvironment(context);
  }
  if (failure) throw failure;
  process.stdout.write(`Compatibility run passed: ${context.runId}\n`);
  process.stdout.write(`Evidence: ${context.evidenceDirectory}\n`);
}

main().catch(async (error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  if (error?.result?.stderr) process.stderr.write(error.result.stderr);
  process.exitCode = 1;
});
