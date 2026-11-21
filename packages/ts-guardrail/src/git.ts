import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

function git(root: string, args: string[]): string {
  return execFileSync('git', ['-c', 'core.quotepath=off', ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 512,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function splitZ(output: string): string[] {
  return output.split('\0').filter((entry) => entry.length > 0);
}

export function repoRoot(cwd: string): string {
  return git(cwd, ['rev-parse', '--show-toplevel']).trim();
}

export function hasHead(root: string): boolean {
  try {
    git(root, ['rev-parse', '--verify', '-q', 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

/** Tracked plus untracked (not ignored) files below root, relative to root. */
export function listAllFiles(root: string): string[] {
  return splitZ(git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']));
}

export function listUntracked(root: string): string[] {
  return splitZ(git(root, ['ls-files', '-z', '--others', '--exclude-standard']));
}

export function listStagedFiles(root: string): string[] {
  return splitZ(git(root, ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z', '--relative']));
}

/** Renamed files of the staged changes (or of the working tree against HEAD): new path to old path. */
export function listRenames(root: string, mode: { staged: boolean }): Map<string, string> {
  const base = ['diff', '--name-status', '-M', '-z', '--relative'];
  const range = mode.staged ? ['--cached'] : [hasHead(root) ? 'HEAD' : EMPTY_TREE];
  const fields = splitZ(git(root, [...base, ...range]));
  const renames = new Map<string, string>();
  for (let index = 0; index < fields.length; index++) {
    const status = fields[index];
    if (status.startsWith('R') || status.startsWith('C')) {
      if (status.startsWith('R')) renames.set(fields[index + 2], fields[index + 1]);
      index += 2;
    } else {
      index += 1;
    }
  }
  return renames;
}

/** Unified diff with zero context: staged changes, or the working tree against HEAD. */
export function diffAdded(root: string, mode: { staged: boolean }): string {
  const base = ['diff', '--no-color', '--no-ext-diff', '-U0', '--relative'];
  if (mode.staged) return git(root, [...base, '--cached']);
  return git(root, [...base, hasHead(root) ? 'HEAD' : EMPTY_TREE]);
}

/** Extracts the HEAD tree below root into an existing directory. */
export function extractHead(root: string, destination: string): void {
  const prefix = git(root, ['rev-parse', '--show-prefix']).trim();
  const tar = `${destination}.tar`;
  try {
    git(root, ['archive', '--format=tar', '-o', tar, prefix ? `HEAD:${prefix}` : 'HEAD']);
    execFileSync('tar', ['-xf', tar, '-C', destination]);
  } finally {
    fs.rmSync(tar, { force: true });
  }
}
