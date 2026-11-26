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

### Test files

A file is a test file if its name or path matches one of `testFilePatterns`. The defaults:

- names: `*.spec.ts`, `*.test.ts`, `*Test.java`, `*Tests.java`, `*IT.java`
- folders, at any depth: `**/src/test/**` (Maven/Gradle, in every module), `**/__tests__/**`, `**/e2e/**` (all languages), and JS/TS files under `**/test/**`

Each runtime only looks at its own language files (`.java`, or JS/TS), so a Java package named `test` under `src/main/java` stays production code. So builders, fixtures, fakes and e2e support files in a test folder count as tests too. Test files get `maxTestFunctionLines` (50) instead of `maxFunctionLines` (25). All other rules still apply to them. They are left out of the cycle check: a test file can neither create nor join a `CIRCULAR_DEPENDENCY`. An explicit `testFilePatterns` replaces this list.

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

Run the **Release** workflow (`bump`: patch/minor/major, `dry_run` builds and tests only).

- **`release` job:** tests both CLIs, stamps the version, tags `v<version>` and creates the GitHub release with all artefacts: the npm tarball, `onecx-guardrail-java-<version>.zip`, the loose Java sources (`*.java`, what `jbang` resolves from the release URL) and `SHA256SUMS`.
- **`npm` job:** publishes `@onecx/guardrail` independently of the GitHub release, via npm trusted publishing (OIDC, no token). It never fails the run; if it fails, fix the npm configuration and re-run the workflow with `tag=v<version>` to publish only.

One-time npm setup (package settings on npmjs.com, "Trusted publisher" → GitHub Actions): organization `onecx`, repository `onecx-guardrail`, workflow filename `release.yml`, no environment.

## Development

```sh
cd packages/ts-guardrail && npm ci && npm test
cd packages/java-guardrail && ./check-embedded-config.sh && ./test.sh   # needs jbang
```

License: Apache-2.0
