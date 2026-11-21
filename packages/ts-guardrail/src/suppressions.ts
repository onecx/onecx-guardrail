import * as fs from 'node:fs';
import * as path from 'node:path';
import parseDiff from 'parse-diff';
import { isInspectable } from './files';
import { diffAdded, listUntracked } from './git';
import { GuardrailConfig, Violation } from './types';

export interface AddedLine {
  file: string;
  line: number;
  text: string;
}

export function parseAddedLines(diff: string): AddedLine[] {
  const added: AddedLine[] = [];
  for (const entry of parseDiff(diff)) {
    if (!entry.to || entry.to === '/dev/null') continue;
    for (const change of entry.chunks.flatMap((chunk) => chunk.changes)) {
      if (change.type === 'add') added.push({ file: entry.to, line: change.ln, text: change.content.slice(1) });
    }
  }
  return added;
}

export function wholeFileLines(root: string, file: string): AddedLine[] {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  return text.split(/\r?\n/).map((line, index) => ({ file, line: index + 1, text: line }));
}

export interface AddedSource {
  root: string;
  staged: boolean;
  config: GuardrailConfig;
}

/** Added lines of the change under inspection; untracked files count as fully added. */
export function collectAddedLines(source: AddedSource): AddedLine[] {
  const lines = parseAddedLines(diffAdded(source.root, { staged: source.staged }));
  if (!source.staged) {
    for (const file of listUntracked(source.root)) lines.push(...wholeFileLines(source.root, file));
  }
  return lines.filter((entry) => isInspectable(entry.file, source.config));
}

/** One violation per line that contains any pattern. */
export function scanLines(lines: AddedLine[], patterns: string[]): Violation[] {
  return lines
    .filter((entry) => patterns.some((pattern) => entry.text.includes(pattern)))
    .map((entry) => ({
      rule: 'FORBIDDEN_SUPPRESSION',
      target: `${entry.file}:${entry.line}`,
      before: null,
      after: 1,
      limit: 0,
    }));
}
