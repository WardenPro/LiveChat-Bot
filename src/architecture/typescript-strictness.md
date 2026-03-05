# TypeScript Strictness Policy And Exception Backlog (US-009)

## Why
Tighten compiler safety without breaking legacy runtime behavior by enforcing `noImplicitAny` globally and rolling
in stricter flags on refactor-target modules first.

## Strictness Matrix

| Profile | Config | Scope | Flags |
| --- | --- | --- | --- |
| Baseline compile gate | `tsconfig.json` | Entire `src/**` | `strict: true`, `noImplicitAny: true`, `strictPropertyInitialization: false` (legacy compatibility) |
| Refactor strict phase | `tsconfig.strict.json` | `src/services/{env,errors,validation}` | `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`, `noPropertyAccessFromIndexSignature: true` |

## Build Enforcement

- `pnpm build` now runs:
  - `tsc -p tsconfig.json`
  - `tsc -p tsconfig.strict.json --noEmit`
- Result: introducing a new implicit `any` in touched paths fails build checks.

## Temporary Exception Backlog

| Location | Exception | Owner | Removal Ticket |
| --- | --- | --- | --- |
| `src/types/strictness-exceptions.d.ts` | Temporary ambient declarations for `lodash` and `mime-types` until official typings are integrated | `@livechat-maintainers` | `LC-TS-009` |
| `src/index.ts` | `process.env = env` compatibility assignment requires `@ts-expect-error` due mixed non-string env schema values | `@livechat-maintainers` | `LC-TS-009` |
| `src/server.ts` | Fastify instance decoration typing gap requires `@ts-expect-error` on custom instance cast | `@livechat-maintainers` | `LC-TS-009` |
| `src/services/media/mediaSourceResolver.ts` | Node stream `.destroy()` compatibility call on fetch response body requires `@ts-expect-error` | `@livechat-maintainers` | `LC-TS-009` |

## Rollout Notes

- The refactor strict phase is intentionally scoped to core service modules actively refactored in US-006 through US-008.
- Remaining legacy paths stay on baseline strictness until follow-up typing stories (`US-010+`) remove backlog exceptions.
