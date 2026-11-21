import * as fs from 'node:fs';
import * as path from 'node:path';
import { BaselineBefore, BeforeSource, HardBefore, HeadBefore, RenameAwareBefore } from './before';
import { buildBaseline, DEFAULT_BASELINE, readBaseline, writeBaseline } from './baseline';
import {
  analyzeFile,
  CheckContext,
  cloneViolations,
  cycleViolations,
  metricViolations,
  suppressionViolations,
} from './checks';
import { findClones } from './clones';
import { cycleKey, findCycles } from './cycles';
import { loadConfig } from './config';
import { isInspectable } from './files';
import { hasHead, listAllFiles, listRenames, listStagedFiles, repoRoot } from './git';
import { GuardrailConfig, RunOptions, RunResult, UsageError } from './types';

interface Workspace {
  root: string;
  config: GuardrailConfig;
  all: string[];
}

function openWorkspace(options: RunOptions): Workspace {
  const root = options.root ? path.resolve(options.root) : repoRoot(process.cwd());
  const config = loadConfig({ root, configPath: options.config });
  const all = listAllFiles(root).filter((file) => isInspectable(file, config) && fs.existsSync(path.join(root, file)));
  return { root, config, all: [...new Set(all)].sort() };
}

function baselinePath(options: RunOptions, root: string): string {
  return options.baseline ? path.resolve(options.baseline) : path.join(root, DEFAULT_BASELINE);
}

function chooseBefore(options: RunOptions, workspace: Workspace): BeforeSource {
  if (options.strict) return new HardBefore();
  const file = baselinePath(options, workspace.root);
  if (fs.existsSync(file)) return new BaselineBefore(readBaseline(file));
  if (options.baseline) throw new UsageError(`baseline file not found: ${file}`);
  return hasHead(workspace.root) ? new HeadBefore(workspace) : new HardBefore();
}

async function initBaseline(options: RunOptions, workspace: Workspace): Promise<RunResult> {
  const { root, config, all } = workspace;
  const metrics = all.flatMap((file) => analyzeFile(workspace, file));
  const cycles = (await findCycles({ root, files: all })).map(cycleKey);
  const clones = (await findClones({ root, files: all, config })).map((clone) => clone.key);
  const target = baselinePath(options, root);
  writeBaseline(target, buildBaseline({ metrics, cycles, clones }));
  return { violations: [], filesChecked: all.length, message: `Baseline written to ${target}` };
}

async function check(ctx: CheckContext): Promise<RunResult> {
  const violations = [
    ...metricViolations(ctx),
    ...(await cycleViolations(ctx)),
    ...(await cloneViolations(ctx)),
    ...suppressionViolations(ctx),
  ];
  return { violations, filesChecked: ctx.inspected.length };
}

export async function runGuardrail(options: RunOptions): Promise<RunResult> {
  const workspace = openWorkspace(options);
  if (options.initBaseline) return initBaseline(options, workspace);
  const staged = listStagedFiles(workspace.root).filter((file) => isInspectable(file, workspace.config));
  const inspected = options.staged ? staged : workspace.all;
  const before = new RenameAwareBefore(
    chooseBefore(options, workspace),
    options.strict || !hasHead(workspace.root) ? new Map() : listRenames(workspace.root, { staged: Boolean(options.staged) }),
  );
  try {
    return await check({ ...workspace, strict: options.strict, staged: options.staged, inspected, before });
  } finally {
    before.close();
  }
}
