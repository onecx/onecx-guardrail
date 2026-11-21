import picomatch from 'picomatch';
import { GuardrailConfig } from './types';

const LANGUAGE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const DECLARATION = /\.d\.[cm]?ts$/;

/** Globs without a slash match the base name, others the whole relative path. */
export function matchesAny(file: string, globs: string[]): boolean {
  const withSlash = globs.filter((glob) => glob.includes('/'));
  const withoutSlash = globs.filter((glob) => !glob.includes('/'));
  const base = file.slice(file.lastIndexOf('/') + 1);
  const hits = (subject: string, patterns: string[]): boolean =>
    patterns.length > 0 && picomatch.isMatch(subject, patterns, { dot: true });
  return hits(file, withSlash) || hits(base, withoutSlash);
}

export function isLanguageFile(file: string): boolean {
  return LANGUAGE.test(file) && !DECLARATION.test(file);
}

export function isInspectable(file: string, config: GuardrailConfig): boolean {
  if (!isLanguageFile(file) || matchesAny(file, config.exclude)) return false;
  return config.include.length === 0 || matchesAny(file, config.include);
}

export function isTestFile(file: string, config: GuardrailConfig): boolean {
  return matchesAny(file, config.testFilePatterns);
}
