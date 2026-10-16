#!/usr/bin/env node
// PreToolUse hook for the reviewer subagent: allow only read-only git commands
// and the project's verification scripts. Exit code 2 = block.

'use strict';

const ALLOWED = [
  /^git (status|diff|log|show)( |$)/,
  /^pnpm (verify|typecheck|lint|test|test:integration)( |$)/,
  /^pnpm (prisma validate|list)( |$)/,
];

let data = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { data += chunk; });
process.stdin.on('end', () => {
  let command = '';
  try {
    const payload = JSON.parse(data);
    command = typeof payload?.tool_input?.command === 'string' ? payload.tool_input.command.trim() : '';
  } catch {
    process.stderr.write('reviewer-allow-bash: could not parse hook input; blocking.\n');
    process.exit(2);
  }
  // Reject compound commands so an allowed prefix cannot smuggle another command.
  // Block flags that turn an allowed command into a file write.
  const WRITE_FLAGS = /(^|\s)(--output(=|\s|$)|-o(\s|$)|--coverage|--ext-diff|--json\b|--outputFile)/;
  if (/[;&|`$<>]/.test(command) || WRITE_FLAGS.test(command) || !ALLOWED.some((re) => re.test(command))) {
    process.stderr.write(`Reviewer is read-only. Command not allowed: ${command}\n`);
    process.exit(2);
  }
  process.exit(0);
});
