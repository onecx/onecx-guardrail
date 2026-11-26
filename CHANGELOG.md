# Changelog

## 0.0.2

### Fixed

- Test helpers in test folders were treated as production code. Builders, fixtures, fakes or `support.ts` files are examples, when their name did not end in `Test`/`Tests`/`IT`/`.spec.ts`/`.test.ts`. This applied the production `maxFunctionLines` to them. Their imports also counted in the package cycle check, so a helper in `src/test` could close a cycle that production code does not have.
- TypeScript: test files no longer take part in the cycle check, matching Java.

### Changed

- New default `testFilePatterns` for both runtimes: `**/src/test/**` (Maven/Gradle, in every module), `**/__tests__/**`, `**/e2e/**` and JS/TS files under `**/test/**`, in addition to the name patterns. An explicit `testFilePatterns` in `.guardrailrc.json` is applied as before.

## 0.0.1

- First release.
