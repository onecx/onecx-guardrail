# Changelog

## 0.0.2

### Fixed

- Test helpers in test folders (builders, fixtures, fakes, e2e `support.ts`) counted as production code unless their name ended in `Test`/`Tests`/`IT`/`.spec.ts`/`.test.ts`. They got the production `maxFunctionLines`, and their imports counted in the package cycle check, so a helper in `src/test` could close a cycle that production code does not have.
- TypeScript: test files no longer take part in the cycle check, matching Java.
- Java: list options in `.guardrailrc.json` (`testFilePatterns`, `exclude`, `include`, `suppressionPatterns`) now replace the defaults, as documented and as in TypeScript. Before, they were appended to the defaults. Thresholds still merge key-wise.

### Changed

- New default `testFilePatterns` for both runtimes: `**/src/test/**` (Maven/Gradle, in every module), `**/__tests__/**`, `**/e2e/**` and JS/TS files under `**/test/**`, in addition to the name patterns. An explicit `testFilePatterns` in `.guardrailrc.json` replaces them.

## 0.0.1

- First release.
