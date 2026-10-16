#!/usr/bin/env node
// PreToolUse hook: blocks git commands that write history, including forms
// that permission deny rules cannot match (git -C ., git -c x=y, /usr/bin/git,
// sh -c '...', quoted subcommands). Exit code 2 = block; stderr is shown to Claude.

'use strict';

const BLOCKED_SUBCOMMANDS = new Set([
  'add', 'commit', 'merge', 'rebase', 'push', 'reset', 'checkout', 'switch',
  'stash', 'tag', 'restore', 'cherry-pick', 'revert', 'clean', 'am', 'apply',
  'pull', 'rm', 'mv', 'update-ref', 'filter-branch', 'replace', 'notes',
]);

// Global git options that take a separate value argument (e.g. `git -C dir`).
const OPTIONS_WITH_VALUE = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path',
  '--config-env', '--super-prefix',
]);

/** Read all of stdin as a string. */
function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

/** Narrow unknown JSON to the shape we need. */
function extractCommand(payload) {
  if (typeof payload !== 'object' || payload === null) return null;
  const toolInput = payload.tool_input;
  if (typeof toolInput !== 'object' || toolInput === null) return null;
  return typeof toolInput.command === 'string' ? toolInput.command : null;
}

/** Strip quotes so `git 'push'` and `git "push"` are treated as `git push`. */
function normalize(command) {
  return command.replace(/['"\\]/g, ' ');
}

/**
 * Find the git subcommand for every git invocation in the command text.
 * Splits on shell separators and scans tokens, so it also catches git inside
 * `sh -c "..."`, `$(...)`, or after `cd x &&`.
 */
function findGitSubcommands(command) {
  const segments = normalize(command).split(/&&|\|\||;|\||&|\n|\$\(|`|\)/);
  const found = [];

  for (const segment of segments) {
    const tokens = segment.trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i += 1) {
      const base = tokens[i].split('/').pop();
      if (base !== 'git') continue;

      // Skip global options to reach the real subcommand.
      let j = i + 1;
      while (j < tokens.length && tokens[j].startsWith('-')) {
        j += OPTIONS_WITH_VALUE.has(tokens[j]) ? 2 : 1;
      }
      if (j < tokens.length) found.push(tokens[j]);
    }
  }
  return found;
}

async function main() {
  let payload;
  try {
    payload = JSON.parse(await readStdin());
  } catch {
    // Unparseable input: fail closed.
    process.stderr.write('block-git-write: could not parse hook input; blocking.\n');
    process.exit(2);
  }

  const command = extractCommand(payload);
  if (command === null) process.exit(0);

  const blocked = findGitSubcommands(command).filter((sub) => BLOCKED_SUBCOMMANDS.has(sub));
  if (blocked.length > 0) {
    process.stderr.write(
      `Blocked by project policy: AI may not run git ${blocked.join(', ')}. ` +
      'Only git status / diff / log are allowed. Propose the command and commit ' +
      'message to the user instead; the user executes all history-writing git commands.\n',
    );
    process.exit(2);
  }
  process.exit(0);
}

main();