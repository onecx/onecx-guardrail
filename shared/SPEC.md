# onecx-guardrail specification

Both CLIs (`packages/ts-guardrail`, `packages/java-guardrail`) implement this contract and must emit identical diagnostics for identical findings.

## CLI

```
onecx-guardrail [--staged] [--baseline <path>] [--init-baseline] [--strict]
                [--config <path>] [--format agent|json] [--root <dir>]
```

| Flag | Meaning |
|---|---|
| `--staged` | Inspect only files in `git diff --cached --name-only --diff-filter=ACMR`, compared against `HEAD`. Without it: all tracked + untracked (non-ignored) files of the language. |
| `--baseline <path>` | Ratchet baseline file (default: `.guardrail-baseline.json` if present). |
| `--init-baseline` | Write the baseline from the current state (all metrics, all violations) and exit 0. |
| `--strict` | Ignore baseline and HEAD; every inspected file must satisfy the hard thresholds. |
| `--config <path>` | `.guardrailrc.json` (default: `<root>/.guardrailrc.json` if present). Merged over `shared/default-config.json`; shipped inside each CLI as an embedded copy. |
| `--format` | `agent` (default, human/agent text) or `json` (`shared/output.schema.json`). |
| `--root <dir>` | Repository root (default: `git rev-parse --show-toplevel` of cwd). |

Exit codes: `0` pass, `1` violations, `2` usage/internal error.

## Ratchet logic

Metric key = `<rule>|<relative file>|<symbol>` (symbol = function/method name with owner, e.g. `Foo.bar`; file-level rules use `-`; edge rules use `a -> b`).

1. **New file** (not present in `HEAD`, or not in baseline when baseline mode): every threshold is hard.
2. **Modified file**: the previous version is read with `git show HEAD:<file>` into an isolated temp directory (`os tmpdir/onecx-guardrail-*`, deleted afterwards) and analysed with the same engine. For each metric key:
   - key absent before → new: must satisfy the hard threshold;
   - key present before: a violation is reported iff `after > limit` **and** `after > before`.
   So legacy debt (already over the limit) passes when unchanged or improved, fails when it grows (`delta > 0`), and anything that crosses the limit fails. Growth that stays within the limit is not a violation.
3. **Baseline mode** (`--baseline` given or default file exists, not `--strict`): `before` comes from the baseline instead of `HEAD`; keys missing in the baseline are new. Files not in the baseline are new files.
4. **Package/module cycles**: set of strongly connected components (size > 1, or self-loop) of the import graph. A cycle is new if its sorted member set is not present in `HEAD`/baseline. Only new cycles fail.
5. **Duplicates (TS only)**: a jscpd clone fails if at least one of its two sides is in an inspected file and it was not already in `HEAD`/baseline (key: both fragment locations normalised by file + content hash of the fragment).
6. **Suppressions**: only added lines (`+` lines in `git diff --cached -U0`; in non-staged mode: `git diff HEAD -U0`) are scanned. Every match of a `suppressionPatterns` entry is `FORBIDDEN_SUPPRESSION`. Not subject to ratchet or baseline. `--strict` additionally scans whole files.

## Baseline file format (`.guardrail-baseline.json`)

```json
{
  "version": 1,
  "runtime": "ts",
  "metrics": { "FUNCTION_TOO_LONG|src/a.ts|foo": 31 },
  "files": { "src/a.ts": 120 },
  "cycles": ["src/a.ts|src/b.ts"],
  "clones": ["<hash>"]
}
```

Keys sorted, 2-space indent, trailing newline (deterministic, diff-friendly). `files` = every analysed file (so "new file" is decidable). Both runtimes may write only their own `runtime`; a repo with both languages uses two baseline files.

## Rules

| Code | Limit (default) | Principle | Why | Fix |
|---|---|---|---|---|
| `FUNCTION_TOO_LONG` | 25 non-blank, non-comment lines (50 in tests) | Small Functions / Single Responsibility | Long functions mix several reasons to change and are hard to read and test. | Extract cohesive blocks into well-named private functions; keep one level of abstraction per function. |
| `FILE_TOO_LONG` | 250 non-blank, non-comment lines (Java: NCSS) | Single Responsibility / High Cohesion | Large files collect unrelated responsibilities and cause merge conflicts. | Split by responsibility into separate modules/classes; move helpers next to their only user. |
| `CYCLOMATIC_COMPLEXITY` | 10 | Low Complexity | Many independent paths need many tests and hide bugs. | Replace branching with guard clauses, lookup maps/strategies or polymorphism; extract decisions into named predicates. |
| `COGNITIVE_COMPLEXITY` | 15 | Readability / Flat Control Flow | Nested and interrupted flow is hard to follow. | Use early returns, extract nested blocks, flatten loops with stream/array helpers. |
| `NESTING_TOO_DEEP` | 3 | Guard Clauses | Deep nesting hides the happy path. | Invert conditions and return/continue early; extract the inner block. |
| `SWITCH_TOO_MANY_CASES` | 5 | Open/Closed / Strategy | Large switches grow with every new variant and duplicate across the code. | Use a strategy map (`Record<Key, Handler>` / `Map`) or polymorphism. |
| `TOO_MANY_PARAMETERS` | 3 (constructors Java: 6) | Clean Function Signatures | Long parameter lists are easy to misorder and signal missing abstractions. | Introduce a typed options/parameter object grouping related values. |
| `BOOLEAN_FLAG_PARAMETER` | 0 (setters and overrides exempt) | No Flag Arguments | A boolean parameter means the function does two things. | Split into two intention-revealing functions and let the caller choose. |
| `FAN_OUT_TOO_HIGH` | 15 imports (TS: non-type imports; Java: ClassFanOutComplexity) | Low Coupling | Many collaborators make a unit fragile and hard to test. | Split the unit, introduce a facade, or depend on a narrower interface. |
| `CIRCULAR_DEPENDENCY` | none new | Acyclic Dependencies Principle | Cycles prevent independent change, build and test. | Extract the shared part into a third module/package or invert one dependency via an interface. |
| `DUPLICATE_CODE` (TS) | 15 lines / 120 tokens | DRY | Copies diverge and bugs must be fixed multiple times. | Extract the shared logic into one function/module used by both places. |
| `GOD_CLASS` (Java) | none | Single Responsibility | A class that knows and does too much attracts every change. | Split along responsibilities; move behaviour to the data it uses. |
| `FORBIDDEN_SUPPRESSION` | none | Fix, don't hide | Suppressions defeat the guardrail and let debt grow silently. | Remove the suppression comment and fix the underlying design problem. |

Metrics for `before`/`after`/`limit`: the numeric value; `before` is `null` when new; boolean/cycle/clone/suppression violations use `after = 1`, `limit = 0`.

## Counting definitions (TS and Java must agree where comparable)

- Lines: non-blank lines that are not purely comment lines, from the first to last line of the function/method (declaration included).
- Cyclomatic: 1 + `if`, `for`, `while`, `do`, `case` (non-default), `catch`, ternary, `&&`, `||`, `??`.
- Cognitive: Sonar rules (increment + nesting increment for control structures; +1 for each sequence of like logical operators; +1 per `else`/`else if`; lambdas/nested functions increase nesting).
- Nesting: maximum depth of nested `if/for/while/do/switch/try/catch` inside the function body (body = depth 0).
- Switch cases: number of non-default `case` labels.
- Parameters: formal parameters (TS: excluding `this`); boolean = type annotation `boolean` (or literal `true|false`, or default value `true|false`); Java: `boolean`/`Boolean`.
- Setter exemption: name starts with `set` followed by an uppercase letter, exactly 1 parameter. Java also exempts methods annotated `@Override`.

## Agent output (`--format agent`)

```text
[ONECX-GUARDRAIL FAILED] Commit blocked by deterministic Clean Code & architecture checks.
Do NOT add suppression comments (NOPMD, @SuppressWarnings, eslint-disable, jscpd:ignore).
Fix the design and re-run the guardrail.

1. VIOLATION: <RULE_CODE>
   - Target: <file path, method/function name, or module/package edge>
   - Metric: <before> -> <after> (allowed: <= <limit>)
   - Clean Code Principle: <principle>
   - Why: <why>
   - Fix: <fix>

2. VIOLATION: ...

Re-run: <the exact command that was run>
```

- Violations numbered from 1, sorted by (rule, target). `<before>` prints `new` when null. `allowed: <= 0` for zero-tolerance rules.
- Target format: `path/File.ext :: Owner.method` for symbols, `path/File.ext` for files, `a -> b -> a` for cycles (sorted members), `path/a.ts:10-30 <-> path/b.ts:5-25` for clones, `path/File.ext:<line>` for suppressions.
- Printed to stderr. On success: single line `[ONECX-GUARDRAIL PASSED] <n> file(s) checked.` to stdout.
- `--format json`: JSON per `output.schema.json` to stdout. stderr carries only diagnostics about files that were skipped because they could not be parsed (`onecx-guardrail: skipped <file> (<reason>)`).

## Known runtime differences

- **Size metric (Java):** function and class size are PMD NCSS statements (lone braces and blank/comment lines are not counted), so Java values read lower than the TypeScript non-blank, non-comment line count.
- **Fan-out (Java):** PMD `ClassFanOutComplexity` also counts inferred types, so a class with 15 imports can score higher. TypeScript counts non-type import declarations.
- **Cycles:** TypeScript treats `import { T }` of a type as a runtime edge unless written `import type`. Java ignores test sources for package cycles.
- **Renames (TypeScript):** renamed files carry their history (`git diff -M`) so legacy debt is not re-reported as new.
- **Unparseable files** are skipped with a stderr notice rather than failing the run.
