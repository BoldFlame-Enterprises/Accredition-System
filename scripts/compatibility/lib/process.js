import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export class CommandError extends Error {
  constructor(command, args, result) {
    super(`${command} ${args.join(' ')} exited with status ${result.code}`);
    this.name = 'CommandError';
    this.command = command;
    this.args = args;
    this.result = result;
  }
}

function invocation(command, args) {
  if (process.platform === 'win32' && command === 'npm') {
    const bundledNpm = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    const npmCli = process.env.npm_execpath || (fs.existsSync(bundledNpm) ? bundledNpm : undefined);
    if (!npmCli) throw new Error('npm CLI location is unavailable for the compatibility harness');
    return { command: process.execPath, args: [npmCli, ...args] };
  }
  return { command, args };
}

export async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const invoked = invocation(command, args);
    const child = spawn(invoked.command, invoked.args, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    if (!options.inherit) {
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
    }
    child.on('error', reject);
    child.on('close', (code, signal) => {
      const result = { code: code ?? 1, signal, stdout, stderr };
      if (result.code !== 0 && !options.allowFailure) {
        reject(new CommandError(command, args, result));
      } else {
        resolve(result);
      }
    });
  });
}
