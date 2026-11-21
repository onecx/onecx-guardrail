# onecx-guardrail

Deterministic, offline-capable Clean Code & architecture guardrail for Git hooks and coding agents. One spec, two runtimes with identical diagnostics:

| Runtime | Package | Run |
|---|---|---|
| TypeScript / Node 20+ | `packages/ts-guardrail` | `npx --prefer-offline -y @onecx/guardrail@<version>` or `npx github:onecx/onecx-guardrail#v<version>` |
| Java 17+ | `packages/java-guardrail` | `jbang guardrail@onecx` or `jbang https://github.com/onecx/onecx-guardrail/releases/download/v<version>/OnecxGuardrail.java` |

Register the JBang catalog once: `jbang catalog add --name onecx https://github.com/onecx/onecx-guardrail` (alias `guardrail@onecx`). All tool versions are pinned; nothing is downloaded at runtime except the pinned dependencies on first run.

The contract (flags, ratchet, baseline, rule codes, output) lives in [`shared/SPEC.md`](shared/SPEC.md); defaults in [`shared/default-config.json`](shared/default-config.json).

## Usage

```
guardrail [--staged] [--baseline <path>] [--init-baseline] [--strict]
          [--config <path>] [--format agent|json] [--root <dir>]
```

| Flag | Meaning |
|---|---|
| `--staged` | Inspect only staged files, compared against `HEAD`. |
| `--baseline <path>` | Ratchet against a baseline (default `.guardrail-baseline.json` if present). |
| `--init-baseline` | Write the baseline from the current state and exit 0. |
| `--strict` | No baseline/HEAD fallback; every file must meet the hard thresholds. |
| `--config <path>` | `.guardrailrc.json` overriding the defaults. |
| `--format agent\|json` | Agent-readable text (default) or JSON (`shared/output.schema.json`). |

Exit codes: `0` pass, `1` violations, `2` usage/internal error.

### Ratchet mode (legacy codebases)

- New files must meet all thresholds.
- Modified files are compared with `HEAD` (`git show HEAD:<file>` into a temp dir) or the baseline: a metric over its limit that grows, a metric crossing the limit, or a new cycle/clone fails. Unchanged or improved legacy debt passes.
- Added suppression comments (`NOPMD`, `@SuppressWarnings`, `eslint-disable`, `@ts-ignore`, `@ts-expect-error`, `jscpd:ignore`) always fail as `FORBIDDEN_SUPPRESSION`.

```sh
guardrail --init-baseline   # once, commit .guardrail-baseline.json
guardrail --staged          # in the hook
```

### Git hooks

`.git/hooks/pre-commit` (or Husky / lefthook / pre-commit framework):

```sh
#!/bin/sh
npx --prefer-offline -y @onecx/guardrail@<version> --staged || exit 1
# Java repositories:
# jbang guardrail@onecx --staged || exit 1
```

`pre-push` (whole-repo ratchet): same command without `--staged`.

### Configuration (`.guardrailrc.json`)

Optional. Thresholds merge key-wise over the defaults; arrays replace.

```json
{ "version": 1, "thresholds": { "maxFanOut": 20 }, "exclude": ["**/generated/**"] }
```

## Rules

| Code | Default limit | Principle |
|---|---|---|
| `FUNCTION_TOO_LONG` | 25 lines / NCSS (50 in tests) | Small functions |
| `FILE_TOO_LONG` | 250 | Single responsibility |
| `CYCLOMATIC_COMPLEXITY` | 10 | Low complexity |
| `COGNITIVE_COMPLEXITY` | 15 | Flat control flow |
| `NESTING_TOO_DEEP` | 3 | Guard clauses |
| `SWITCH_TOO_MANY_CASES` | 5 | Strategy map / polymorphism |
| `TOO_MANY_PARAMETERS` | 3 (Java constructors 6) | Parameter object |
| `BOOLEAN_FLAG_PARAMETER` | 0 (setters, overrides exempt) | No flag arguments |
| `FAN_OUT_TOO_HIGH` | 15 | Low coupling |
| `CIRCULAR_DEPENDENCY` | no new cycles | Acyclic dependencies (madge / package SCC) |
| `DUPLICATE_CODE` (TS) | 15 lines / 120 tokens | DRY (jscpd) |
| `GOD_CLASS` (Java) | none | Single responsibility (PMD) |
| `FORBIDDEN_SUPPRESSION` | none | Fix, do not hide |

Why/Fix texts per rule are in the SPEC and printed with every violation.

## Agent instructions snippet

Paste into `AGENTS.md` / `.github/copilot-instructions.md`:

```md
## Clean Code guardrail

Before every commit run `npx --prefer-offline -y @onecx/guardrail@<version> --staged`
(Java: `jbang guardrail@onecx --staged`). A failing run blocks the commit.
- Fix the root cause with the suggested refactoring (extract function, guard clauses,
  parameter object, strategy map, split module). Behaviour must stay unchanged.
- NEVER add suppression comments (NOPMD, @SuppressWarnings, eslint-disable, @ts-ignore,
  @ts-expect-error, jscpd:ignore) or edit the baseline/config to make the check pass.
- Re-run until it prints `[ONECX-GUARDRAIL PASSED]`.
```

## Releasing

Run the **Release** workflow (`bump`: patch/minor/major). It tests both CLIs, stamps the version, tags `v<version>`, publishes `@onecx/guardrail` to npm (secret `NPM_TOKEN`) and creates a GitHub release with the npm tarball and all Java sources (`*.java`) as assets. `dry_run` builds and tests only.

## Development

```sh
cd packages/ts-guardrail && npm ci && npm test
cd packages/java-guardrail && ./check-embedded-config.sh && ./test.sh   # needs jbang
```

License: Apache-2.0
