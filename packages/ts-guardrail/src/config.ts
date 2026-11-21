import * as fs from 'node:fs';
import * as path from 'node:path';
import { GuardrailConfig, Thresholds, UsageError } from './types';

const ARRAY_KEYS = ['suppressionPatterns', 'include', 'exclude', 'testFilePatterns'] as const;
const TOP_KEYS = new Set<string>(['$schema', 'version', 'thresholds', ...ARRAY_KEYS]);

export function loadDefaults(): GuardrailConfig {
  const file = path.join(__dirname, '..', 'default-config.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as GuardrailConfig;
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new UsageError(`${where} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function mergeThresholds(base: Thresholds, raw: unknown): Thresholds {
  const merged: Record<string, number> = { ...base };
  for (const [key, value] of Object.entries(asRecord(raw, 'thresholds'))) {
    if (!(key in base)) throw new UsageError(`unknown threshold "${key}"`);
    if (!Number.isInteger(value) || (value as number) < 1) {
      throw new UsageError(`threshold "${key}" must be an integer >= 1`);
    }
    merged[key] = value as number;
  }
  return merged as unknown as Thresholds;
}

function readStrings(key: string, value: unknown): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new UsageError(`"${key}" must be an array of strings`);
  }
  return value as string[];
}

/** Thresholds merge key-wise; list options replace the defaults. */
export function mergeConfig(base: GuardrailConfig, rawOverride: unknown): GuardrailConfig {
  const raw = asRecord(rawOverride, '.guardrailrc.json');
  for (const key of Object.keys(raw)) {
    if (!TOP_KEYS.has(key)) throw new UsageError(`unknown config key "${key}"`);
  }
  const result: GuardrailConfig = { ...base };
  if (raw.thresholds !== undefined) result.thresholds = mergeThresholds(base.thresholds, raw.thresholds);
  for (const key of ARRAY_KEYS) {
    if (raw[key] !== undefined) result[key] = readStrings(key, raw[key]);
  }
  return result;
}

export interface ConfigLocation {
  root: string;
  configPath?: string;
}

export function loadConfig(location: ConfigLocation): GuardrailConfig {
  const base = loadDefaults();
  const explicit = location.configPath ? path.resolve(location.configPath) : undefined;
  const file = explicit ?? path.join(location.root, '.guardrailrc.json');
  if (!fs.existsSync(file)) {
    if (explicit) throw new UsageError(`config file not found: ${explicit}`);
    return base;
  }
  try {
    return mergeConfig(base, JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (error) {
    if (error instanceof SyntaxError) throw new UsageError(`invalid JSON in ${file}`);
    throw error;
  }
}
