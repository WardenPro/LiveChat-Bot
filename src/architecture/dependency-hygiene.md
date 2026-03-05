# Dependency Hygiene Report (US-011)

Date: 2026-03-05
Scope: patch-only dependency hygiene for `livechat-ccb`

## Audit Summary

Commands used:
- `pnpm list --depth 0`
- `pnpm outdated`
- `pnpm audit --prod --audit-level=moderate`
- `pnpm list undici minimatch --depth 8`
- `pnpm dlx depcheck --json`

Key findings:
- Direct patch updates were available for selected pinned dev dependencies.
- `@t3-oss/env-core` was unused and removed.
- Transitive risk existed around `undici` and `minimatch` when this repo was resolved through a parent workspace, because local `pnpm.overrides` were not applied.
- Adding a local `pnpm-workspace.yaml` made this repository the workspace root and activated overrides, resulting in:
  - `undici` resolved to `6.23.0` (patched for GHSA-g9mf-h72j-4rw9).
  - `minimatch` deduped to `10.2.2` in the resolved tree.
  - `pnpm audit --prod --audit-level=moderate` => `No known vulnerabilities found`.

## Applied Changes (Patch-Only + Hygiene)

| Package | Before | After | Change Type | Rationale | Release Notes Reviewed |
| --- | --- | --- | --- | --- | --- |
| `@commitlint/config-conventional` | `18.6.2` | `18.6.3` | Patch | Keep commit tooling current within same minor line | https://github.com/conventional-changelog/commitlint/releases/tag/v18.6.3 |
| `@types/node` | `20.11.17` | `20.11.30` | Patch | Refresh Node 20 type definitions without runtime behavior changes | https://registry.npmjs.org/@types/node/20.11.30 |
| `@typescript-eslint/eslint-plugin` | `7.0.1` | `7.0.2` | Patch | Patch-level lint stack maintenance | https://github.com/typescript-eslint/typescript-eslint/releases/tag/v7.0.2 |
| `@typescript-eslint/parser` | `7.0.1` | `7.0.2` | Patch | Keep parser aligned with plugin patch release | https://github.com/typescript-eslint/typescript-eslint/releases/tag/v7.0.2 |
| `eslint-config-prettier` | `9.1.0` | `9.1.2` | Patch | Patch-level lint config maintenance | https://github.com/prettier/eslint-config-prettier/blob/main/CHANGELOG.md |
| `@t3-oss/env-core` | `^0.8.0` | removed | Removal | Unused direct dependency (no imports in `src/**`) | https://registry.npmjs.org/@t3-oss/env-core |

Support changes:
- Added `pnpm-workspace.yaml` so this repo is its own workspace root and local `pnpm.overrides` take effect.
- Updated `pnpm-lock.yaml` accordingly.

## Unused Dependency Audit Notes

`depcheck` reported:
- Dependencies: `@t3-oss/env-core`, `zlib-sync`
- Dev dependencies: `@commitlint/cli`, `@commitlint/config-conventional`

Disposition:
- `@t3-oss/env-core`: removed (unused).
- `zlib-sync`: kept intentionally; optional runtime accelerator for websocket stack (`ws`/Socket.IO path), even without direct import.
- `@commitlint/*`: kept; used by `.husky/commit-msg` and `commitlint.config.js` (static analysis false-positive).

## Duplicated Transitive Risk Review

Before local workspace rooting:
- `undici` resolved as `6.21.3` via `discord.js` path in parent-workspace resolution.
- `minimatch` appeared as multiple lines (`3.1.5`, `9.0.3`).

After local workspace rooting and lock refresh:
- `undici` resolved to `6.23.0` along the `discord.js` path.
- `minimatch` resolved to `10.2.2` across the inspected tree.
- Production audit is clean.

## Deferred Updates (Out of Scope)

The following candidates from `pnpm outdated` were explicitly deferred because they are minor/major updates and US-011 is patch-only:

- `eslint-plugin-import` `2.29.1 -> 2.32.0` (minor)
- `eslint-plugin-prettier` `5.1.3 -> 5.5.5` (minor)
- `fastify` `5.7.4 -> 5.8.1` (minor)
- `husky` `9.0.11 -> 9.1.7` (minor)
- `prettier` `3.2.5 -> 3.8.1` (minor)
- `typescript` `5.3.3 -> 5.9.3` (minor)
- `@commitlint/cli` `18.6.1 -> 20.4.3` (major)
- `@gquittet/graceful-server` `4.0.9 -> 6.0.4` (major)
- `@prisma/client` `5.22.0 -> 7.4.2` (major)
- `@types/node` `20.11.30 -> 25.3.3` (major)
- `@typescript-eslint/eslint-plugin` `7.0.2 -> 8.56.1` (major)
- `@typescript-eslint/parser` `7.0.2 -> 8.56.1` (major)
- `date-fns` `3.6.0 -> 4.1.0` (major)
- `dotenv` `16.6.1 -> 17.3.1` (major)
- `eslint` `8.56.0 -> 10.0.2` (major)
- `eslint-config-prettier` `9.1.2 -> 10.1.8` (major)
- `eslint-import-resolver-typescript` `3.10.1 -> 4.4.4` (major)
- `file-type` `19.6.0 -> 21.3.0` (major)
- `mime-types` `2.1.35 -> 3.0.2` (major)
- `pino-pretty` `10.3.1 -> 13.1.3` (major)
- `prisma` `5.22.0 -> 7.4.2` (major)
- `rosetty` `3.1.32 -> 4.0.10` (major)
- `zod` `3.25.76 -> 4.3.6` (major)

## Rollback Notes

If rollback is needed:

1. Revert tracked dependency files:
   - `git checkout -- package.json pnpm-lock.yaml pnpm-workspace.yaml`
2. Reinstall from reverted lock state:
   - `pnpm install`

Targeted rollback (without full file revert):
- Re-add removed package: `pnpm add @t3-oss/env-core@^0.8.0`
- Restore previous patched versions:
  - `pnpm up -D @commitlint/config-conventional@18.6.2 @types/node@20.11.17 @typescript-eslint/eslint-plugin@7.0.1 @typescript-eslint/parser@7.0.1 eslint-config-prettier@9.1.0`
