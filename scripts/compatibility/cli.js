#!/usr/bin/env node
import {
  createRunContext,
  loadRunContext,
  removeSecretEnvironment,
} from './lib/config.js';
import { preflight } from './lib/preflight.js';
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
  if (!['preflight', 'up', 'run', 'collect', 'down'].includes(command)) {
    throw new Error('Usage: cli.js <preflight|up|run|collect|down> [--run-id ID]');
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
  if (command === 'down') {
    await collectLogs(context).catch(() => undefined);
    await stopStack(context);
    await removeSecretEnvironment(context);
    process.stdout.write(`Compatibility stack removed: ${context.runId}\n`);
    return;
  }

  let failure;
  try {
    await preflight(context);
    await startStack(context);
    await runHarnessSmoke(context, { injectAssertionFailure: has('--inject-assertion-failure') });
    if (!has('--skip-browser')) await runBrowserSmoke(context);
    const scenarioGroup = option('--scenario-group');
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
    await removeSecretEnvironment(context);
    if (cleanup.code !== 0) failure ??= cleanup.error ?? new Error('Compatibility cleanup failed');
  }
  if (failure) throw failure;
  process.stdout.write(`Compatibility smoke passed: ${context.runId}\n`);
  process.stdout.write(`Evidence: ${context.evidenceDirectory}\n`);
}

main().catch(async (error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  if (error?.result?.stderr) process.stderr.write(error.result.stderr);
  process.exitCode = 1;
});
