import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { GuardrailConfig } from './types';

export interface CloneSide {
  file: string;
  start: number;
  end: number;
}

export interface Clone {
  key: string;
  a: CloneSide;
  b: CloneSide;
}

export interface CloneInput {
  root: string;
  files: string[];
  config: GuardrailConfig;
}

interface RawSide {
  sourceId: string;
  start: { line: number };
  end: { line: number };
  fragment?: string;
}

interface RawClone {
  duplicationA: RawSide;
  duplicationB: RawSide;
}

interface Jscpd {
  detectClones(options: Record<string, unknown>): Promise<RawClone[]>;
}

// jscpd ships ESM-only type declarations next to a CommonJS entry point.
const jscpd = require('jscpd') as Jscpd;
const FORMATS = ['typescript', 'tsx', 'javascript', 'jsx'];

function sha1(value: string): string {
  return createHash('sha1').update(value).digest('hex');
}

function sideOf(root: string, side: RawSide): CloneSide & { digest: string } {
  const file = path.relative(root, side.sourceId).split(path.sep).join('/');
  const fragment = (side.fragment ?? '').replace(/\s+/g, '');
  return { file, start: side.start.line, end: side.end.line, digest: `${file}:${sha1(fragment)}` };
}

function toClone(root: string, raw: RawClone): Clone {
  const sides = [sideOf(root, raw.duplicationA), sideOf(root, raw.duplicationB)];
  sides.sort((x, y) => x.file.localeCompare(y.file) || x.start - y.start);
  const [a, b] = sides;
  const key = sha1([a.digest, b.digest].sort().join('\n'));
  return { key, a: { file: a.file, start: a.start, end: a.end }, b: { file: b.file, start: b.start, end: b.end } };
}

/** Clones found by jscpd across the given files (relative to root). */
export async function findClones(input: CloneInput): Promise<Clone[]> {
  if (input.files.length === 0) return [];
  const t = input.config.thresholds;
  const raw = await jscpd.detectClones({
    path: input.files.map((file) => path.join(input.root, file)),
    minLines: t.jscpdMinLines,
    minTokens: t.jscpdMinTokens,
    format: FORMATS,
    absolute: true,
    silent: true,
    gitignore: false,
    cache: false,
    reporters: [],
  });
  return raw.map((clone) => toClone(input.root, clone)).sort((x, y) => x.key.localeCompare(y.key));
}

export function cloneTarget(clone: Clone): string {
  const side = (s: CloneSide): string => `${s.file}:${s.start}-${s.end}`;
  return `${side(clone.a)} <-> ${side(clone.b)}`;
}
