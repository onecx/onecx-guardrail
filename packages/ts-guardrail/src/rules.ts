import { RuleCode } from './types';

export interface RuleInfo {
  principle: string;
  why: string;
  fix: string;
}

export const RULES: Record<RuleCode, RuleInfo> = {
  FUNCTION_TOO_LONG: {
    principle: 'Small Functions / Single Responsibility',
    why: 'Long functions mix several reasons to change and are hard to read and test.',
    fix: 'Extract cohesive blocks into well-named private functions; keep one level of abstraction per function.',
  },
  FILE_TOO_LONG: {
    principle: 'Single Responsibility / High Cohesion',
    why: 'Large files collect unrelated responsibilities and cause merge conflicts.',
    fix: 'Split by responsibility into separate modules/classes; move helpers next to their only user.',
  },
  CYCLOMATIC_COMPLEXITY: {
    principle: 'Low Complexity',
    why: 'Many independent paths need many tests and hide bugs.',
    fix: 'Replace branching with guard clauses, lookup maps/strategies or polymorphism; extract decisions into named predicates.',
  },
  COGNITIVE_COMPLEXITY: {
    principle: 'Readability / Flat Control Flow',
    why: 'Nested and interrupted flow is hard to follow.',
    fix: 'Use early returns, extract nested blocks, flatten loops with stream/array helpers.',
  },
  NESTING_TOO_DEEP: {
    principle: 'Guard Clauses',
    why: 'Deep nesting hides the happy path.',
    fix: 'Invert conditions and return/continue early; extract the inner block.',
  },
  SWITCH_TOO_MANY_CASES: {
    principle: 'Open/Closed / Strategy',
    why: 'Large switches grow with every new variant and duplicate across the code.',
    fix: 'Use a strategy map (`Record<Key, Handler>` / `Map`) or polymorphism.',
  },
  TOO_MANY_PARAMETERS: {
    principle: 'Clean Function Signatures',
    why: 'Long parameter lists are easy to misorder and signal missing abstractions.',
    fix: 'Introduce a typed options/parameter object grouping related values.',
  },
  BOOLEAN_FLAG_PARAMETER: {
    principle: 'No Flag Arguments',
    why: 'A boolean parameter means the function does two things.',
    fix: 'Split into two intention-revealing functions and let the caller choose.',
  },
  FAN_OUT_TOO_HIGH: {
    principle: 'Low Coupling',
    why: 'Many collaborators make a unit fragile and hard to test.',
    fix: 'Split the unit, introduce a facade, or depend on a narrower interface.',
  },
  CIRCULAR_DEPENDENCY: {
    principle: 'Acyclic Dependencies Principle',
    why: 'Cycles prevent independent change, build and test.',
    fix: 'Extract the shared part into a third module/package or invert one dependency via an interface.',
  },
  DUPLICATE_CODE: {
    principle: 'DRY',
    why: 'Copies diverge and bugs must be fixed multiple times.',
    fix: 'Extract the shared logic into one function/module used by both places.',
  },
  GOD_CLASS: {
    principle: 'Single Responsibility',
    why: 'A class that knows and does too much attracts every change.',
    fix: 'Split along responsibilities; move behaviour to the data it uses.',
  },
  FORBIDDEN_SUPPRESSION: {
    principle: 'Fix, don\'t hide',
    why: 'Suppressions defeat the guardrail and let debt grow silently.',
    fix: 'Remove the suppression comment and fix the underlying design problem.',
  },
};
