export type RuleCode =
  | 'FUNCTION_TOO_LONG'
  | 'FILE_TOO_LONG'
  | 'CYCLOMATIC_COMPLEXITY'
  | 'COGNITIVE_COMPLEXITY'
  | 'NESTING_TOO_DEEP'
  | 'SWITCH_TOO_MANY_CASES'
  | 'TOO_MANY_PARAMETERS'
  | 'BOOLEAN_FLAG_PARAMETER'
  | 'FAN_OUT_TOO_HIGH'
  | 'CIRCULAR_DEPENDENCY'
  | 'DUPLICATE_CODE'
  | 'GOD_CLASS'
  | 'FORBIDDEN_SUPPRESSION';

export interface Thresholds {
  maxFunctionLines: number;
  maxTestFunctionLines: number;
  maxFileLines: number;
  maxCyclomatic: number;
  maxCognitive: number;
  maxNesting: number;
  maxSwitchCases: number;
  maxParameters: number;
  maxConstructorParameters: number;
  maxFanOut: number;
  jscpdMinLines: number;
  jscpdMinTokens: number;
}

export interface GuardrailConfig {
  thresholds: Thresholds;
  suppressionPatterns: string[];
  include: string[];
  exclude: string[];
  testFilePatterns: string[];
}

/** One measured value with its hard limit. symbol is '-' for file-level rules. */
export interface Metric {
  rule: RuleCode;
  file: string;
  symbol: string;
  value: number;
  limit: number;
}

export interface Violation {
  rule: RuleCode;
  target: string;
  before: number | null;
  after: number | null;
  limit: number | null;
}

export interface RunOptions {
  staged: boolean;
  baseline?: string;
  initBaseline: boolean;
  strict: boolean;
  config?: string;
  root?: string;
}

export interface RunResult {
  violations: Violation[];
  filesChecked: number;
  message?: string;
}

export class UsageError extends Error {}
