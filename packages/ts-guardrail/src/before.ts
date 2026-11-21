import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { analyzeSource } from './analyze';
import { Baseline, baselineMetricsFor } from './baseline';
import { findClones } from './clones';
import { findCycles, cycleKey } from './cycles';
import { isInspectable } from './files';
import { extractHead } from './git';
import { metricMap } from './ratchet';
import { GuardrailConfig } from './types';

/** The previous state that the ratchet compares against (HEAD, baseline, or nothing). */
export interface BeforeSource {
  /** Metric values of a file, or null when the file is new. */
  metricsFor(file: string): Map<string, number> | null;
  cycleKeys(): Promise<Set<string>>;
  cloneKeys(): Promise<Set<string>>;
  close(): void;
}

/** Strict mode and repositories without HEAD: nothing existed before, all limits are hard. */
export class HardBefore implements BeforeSource {
  metricsFor(): null {
    return null;
  }
  async cycleKeys(): Promise<Set<string>> {
    return new Set();
  }
  async cloneKeys(): Promise<Set<string>> {
    return new Set();
  }
  close(): void {}
}

export class BaselineBefore implements BeforeSource {
  constructor(private readonly baseline: Baseline) {}

  metricsFor(file: string): Map<string, number> | null {
    return baselineMetricsFor(this.baseline, file);
  }
  async cycleKeys(): Promise<Set<string>> {
    return new Set(this.baseline.cycles);
  }
  async cloneKeys(): Promise<Set<string>> {
    return new Set(this.baseline.clones);
  }
  close(): void {}
}

export interface HeadContext {
  root: string;
  config: GuardrailConfig;
}

/** HEAD extracted into an isolated os.tmpdir() directory, removed by close(). */
export class HeadBefore implements BeforeSource {
  private dir: string | undefined;

  constructor(private readonly ctx: HeadContext) {}

  private directory(): string {
    if (!this.dir) {
      this.dir = fs.mkdtempSync(path.join(os.tmpdir(), 'onecx-guardrail-'));
      extractHead(this.ctx.root, this.dir);
    }
    return this.dir;
  }

  private files(): string[] {
    const dir = this.directory();
    return fs
      .readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .map((entry) => entry.split(path.sep).join('/'))
      .filter((file) => isInspectable(file, this.ctx.config) && fs.statSync(path.join(dir, file)).isFile());
  }

  metricsFor(file: string): Map<string, number> | null {
    const full = path.join(this.directory(), file);
    if (!fs.existsSync(full)) return null;
    const text = fs.readFileSync(full, 'utf8');
    return metricMap(analyzeSource({ file, text, config: this.ctx.config }));
  }

  async cycleKeys(): Promise<Set<string>> {
    const cycles = await findCycles({ root: this.directory(), files: this.files() });
    return new Set(cycles.map(cycleKey));
  }

  async cloneKeys(): Promise<Set<string>> {
    const clones = await findClones({ root: this.directory(), files: this.files(), config: this.ctx.config });
    return new Set(clones.map((clone) => clone.key));
  }

  close(): void {
    if (this.dir) fs.rmSync(this.dir, { recursive: true, force: true });
    this.dir = undefined;
  }
}

/** A pure move keeps its history: values of the old path count as the "before" of the new path. */
export class RenameAwareBefore implements BeforeSource {
  constructor(
    private readonly inner: BeforeSource,
    private readonly renames: Map<string, string>,
  ) {}

  metricsFor(file: string): Map<string, number> | null {
    const old = this.renames.get(file);
    const previous = this.inner.metricsFor(old ?? file);
    if (!old || !previous) return previous;
    const moved = new Map<string, number>();
    for (const [key, value] of previous) moved.set(key.replace(`|${old}|`, `|${file}|`), value);
    return moved;
  }

  async cycleKeys(): Promise<Set<string>> {
    const keys = await this.inner.cycleKeys();
    const moved = new Map([...this.renames].map(([next, old]) => [old, next]));
    const renamed = [...keys].map((key) =>
      key
        .split('|')
        .map((member) => moved.get(member) ?? member)
        .sort()
        .join('|'),
    );
    return new Set([...keys, ...renamed]);
  }

  cloneKeys(): Promise<Set<string>> {
    return this.inner.cloneKeys();
  }

  close(): void {
    this.inner.close();
  }
}
