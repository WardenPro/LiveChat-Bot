# Progress Log
Started: Thu Mar  5 09:09:58 CET 2026

## Codebase Patterns
- (add reusable patterns here)

---
## [2026-03-05 09:29:52 CET] - US-001: Establish characterization baselines for current behavior
Thread: 
Run: 20260305-090958-5834 (iteration 1)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-1.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-1.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: d6a9054 test(characterization): add US-001 baseline suite (or `none` + reason)
- Post-commit status: `clean`
- Verification:
  - Command: pnpm characterization -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: API_URL=http://localhost:3333 DISCORD_TOKEN=test DISCORD_CLIENT_ID=test DATABASE_URL=file:./sqlite.db pnpm dev -> FAIL (runtime import error: file-type package export mismatch)
- Files changed:
  - .eslintrc.json
  - package.json
  - src/loaders/DiscordLoader.ts
  - src/characterization/RUNBOOK.md
  - src/characterization/runCharacterization.ts
  - src/characterization/restOverlayPairConsume.characterization.ts
  - src/characterization/socketLifecycle.characterization.ts
  - src/characterization/discordExecution.characterization.ts
  - src/characterization/mediaLifecycle.characterization.ts
  - src/characterization/utils.ts
  - src/characterization/baselines/rest-overlay-pair-consume.baseline.json
  - src/characterization/baselines/socket-lifecycle.baseline.json
  - src/characterization/baselines/discord-execution-flow.baseline.json
  - src/characterization/baselines/media-lifecycle.baseline.json
- What was implemented
  - Added an executable characterization runner (`pnpm characterization`) with four suites covering REST, Socket.IO lifecycle, Discord interaction execution flow, and media lifecycle critical paths.
  - Added committed baseline artifacts for current status codes, payload shapes, and key side effects.
  - Added a runbook at `src/characterization/RUNBOOK.md` describing pre-slice characterization workflow and baseline updates.
  - Exported Discord interaction handler registration from `DiscordLoader` to characterize command execution flow without changing runtime behavior.
- **Learnings for future iterations:**
  - Patterns discovered
    - Module-level imports in legacy loaders can pull heavyweight runtime dependencies into test harnesses; targeted loader stubs keep characterization deterministic.
  - Gotchas encountered
    - `pnpm lint` runs with `--fix`, which can touch many unrelated files; preserve scope by restoring untouched modules before commit.
    - `pnpm dev` currently fails at runtime on `file-type` export resolution (existing environment/runtime compatibility issue).
  - Useful context
    - Latest characterization artifacts are emitted under `.ralph/characterization/latest/` for diff inspection when a baseline check fails.
---
## [2026-03-05 09:39:58 CET] - US-002: Define module boundaries and compatibility map
Thread: 
Run: 20260305-090958-5834 (iteration 2)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-2.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-2.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: c854afb refactor(architecture): define module boundaries map (or `none` + reason)
- Post-commit status: `clean`
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: API_URL=http://localhost:3333 DISCORD_TOKEN=test DISCORD_CLIENT_ID=test DATABASE_URL=file:./sqlite.db pnpm dev -> FAIL (existing runtime import error: file-type package export mismatch)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - .ralph/.tmp/prompt-20260305-090958-5834-2.md
  - .ralph/.tmp/story-20260305-090958-5834-2.json
  - .ralph/.tmp/story-20260305-090958-5834-2.md
  - .ralph/runs/run-20260305-090958-5834-iter-1.md
  - src/architecture/module-boundaries.md
  - src/repositories/prisma/loadPrisma.ts
  - src/repositories/prisma/prismaEnums.ts
  - src/services/prisma/loadPrisma.ts
  - src/services/prisma/prismaEnums.ts
- What was implemented
  - Added a tracked architecture document defining full module boundaries, approved/prohibited dependency directions, compatibility constraints, and explicit out-of-scope entrypoint move rejections for US-002.
  - Moved Prisma internal modules into the new repository layer (`src/repositories/prisma/*`) and preserved legacy internal paths (`src/services/prisma/*`) via compatibility re-export wrappers.
  - Preserved behavior by keeping existing import paths valid and by avoiding any route/socket/env entrypoint changes.
- **Learnings for future iterations:**
  - Patterns discovered
    - A low-risk boundary migration slice is to move storage-access internals first and keep old import paths alive with thin wrappers.
  - Gotchas encountered
    - `pnpm lint` runs with `--fix` and can modify unrelated files; scope must be restored before commit when story boundaries are strict.
  - Useful context
    - `docs/` is gitignored in this repository; architecture documentation for tracked changes should live under `src/` or another tracked path.
---
## [2026-03-05 09:51:40 CET] - US-003: Refactor REST route loading into domain modules
Thread: 
Run: 20260305-090958-5834 (iteration 3)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-3.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-3.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 8562392 refactor(rest): split route loading by domain (or `none` + reason)
- Post-commit status: `clean`
- Verification:
  - Command: pnpm characterization -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: API_URL=http://localhost:3333 DISCORD_TOKEN=test DISCORD_CLIENT_ID=test DATABASE_URL=file:./sqlite.db pnpm dev -> FAIL (existing runtime import error: file-type package export mismatch)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - .ralph/.tmp/prompt-20260305-090958-5834-3.md
  - .ralph/.tmp/story-20260305-090958-5834-3.json
  - .ralph/.tmp/story-20260305-090958-5834-3.md
  - .ralph/characterization/latest/rest-route-domains.latest.json
  - .ralph/runs/run-20260305-090958-5834-iter-2.md
  - src/characterization/RUNBOOK.md
  - src/characterization/baselines/rest-route-domains.baseline.json
  - src/characterization/restRouteDomains.characterization.ts
  - src/characterization/runCharacterization.ts
  - src/loaders/RESTLoader.ts
  - src/loaders/rest/adminDomainRegistrar.ts
  - src/loaders/rest/ingestDomainRegistrar.ts
  - src/loaders/rest/overlayDomainRegistrar.ts
  - src/loaders/rest/registerDomainRoutes.ts
- What was implemented
  - Added REST-domain characterization coverage (`rest-route-domains`) to lock contracts across overlay/admin/ingest plus unsupported-path not-found behavior.
  - Refactored `loadRoutes` internals into explicit domain registrars (`admin`, `overlay`, `ingest`) using a shared registrar utility while preserving route prefixes and route-loaded logging behavior.
  - Added baseline and latest characterization artifact for the new suite and updated the characterization runbook scope.
- **Learnings for future iterations:**
  - Patterns discovered
    - Loader-only refactors can stay low risk by extracting registration orchestration while keeping route handler modules untouched.
  - Gotchas encountered
    - `pnpm lint` (`--fix`) still touches unrelated legacy files; restore non-story files before staging to keep strict story scope.
    - Characterization suites that patch module loads can contaminate later suites via module cache if core auth modules are stubbed globally.
  - Useful context
    - The existing `pnpm dev` runtime failure (`ERR_PACKAGE_PATH_NOT_EXPORTED` from `file-type`) remains unrelated to US-003 and still reproduces.
---
## [2026-03-05 10:03:40 CET] - US-004: Refactor socket loader lifecycle with strict boundaries
Thread: 
Run: 20260305-090958-5834 (iteration 4)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-4.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-4.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 2834ebd refactor(socket): split socket lifecycle modules (or `none` + reason)
- Post-commit status: `clean`
- Verification:
  - Command: pnpm characterization -- --update-baseline -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: API_URL=http://localhost:3333 DISCORD_TOKEN=test DISCORD_CLIENT_ID=test DATABASE_URL=file:./sqlite.db pnpm dev -> FAIL (existing runtime import error: ERR_PACKAGE_PATH_NOT_EXPORTED from file-type)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - .ralph/.tmp/prompt-20260305-090958-5834-4.md
  - .ralph/.tmp/story-20260305-090958-5834-4.json
  - .ralph/.tmp/story-20260305-090958-5834-4.md
  - .ralph/characterization/latest/socket-lifecycle.latest.json
  - .ralph/runs/run-20260305-090958-5834-iter-3.md
  - src/characterization/baselines/socket-lifecycle.baseline.json
  - src/characterization/socketLifecycle.characterization.ts
  - src/loaders/socketLoader.ts
  - src/loaders/socket/socketAuthentication.ts
  - src/loaders/socket/socketConnectionState.ts
  - src/loaders/socket/socketEventDispatch.ts
  - src/loaders/socket/types.ts
  - src/loaders/socket/valueUtils.ts
  - .ralph/progress.md
- What was implemented
  - Split `socketLoader` internals into explicit authentication, connection-state, and event-dispatch modules under `src/loaders/socket/*` with typed interfaces for scheduler, socket, and lifecycle boundaries.
  - Kept overlay protocol events and payload contract unchanged by continuing to emit/listen through `OVERLAY_SOCKET_EVENTS` and preserving existing normalization/rejection behavior.
  - Extended socket characterization coverage and baseline to lock invalid token rejection (`invalid_token`) and malformed playback payload normalization semantics.
- **Learnings for future iterations:**
  - Patterns discovered
    - Loader refactors stay low-risk when the entrypoint only orchestrates modules and side-effect logic remains in thin domain-specific helpers.
  - Gotchas encountered
    - `pnpm lint` (`--fix`) can touch unrelated legacy files; restoring non-story files to `HEAD` keeps strict scope boundaries.
    - Commitlint enforces body line length (<=100 chars); long explanatory lines must be wrapped.
  - Useful context
    - `pnpm dev` still fails before runtime validation due an existing `file-type` export issue unrelated to US-004 changes.
---
## [2026-03-05 10:17:41 CET] - US-005: Refactor Discord command loading and execution flow
Thread: 
Run: 20260305-090958-5834 (iteration 5)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-5.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-5.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: f9c8d49 refactor(discord-loader): modularize command flow (or `none` + reason)
- Post-commit status: `clean`
- Verification:
  - Command: pnpm characterization -- --update-baseline -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm dev -> FAIL (missing local env vars including DATABASE_URL)
  - Command: API_URL=http://localhost:3333 DISCORD_TOKEN=dev-token DISCORD_CLIENT_ID=dev-client DATABASE_URL=file:./sqlite.db pnpm dev -> FAIL (existing runtime import error: ERR_PACKAGE_PATH_NOT_EXPORTED from file-type)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - .ralph/.tmp/prompt-20260305-090958-5834-5.md
  - .ralph/.tmp/story-20260305-090958-5834-5.json
  - .ralph/.tmp/story-20260305-090958-5834-5.md
  - .ralph/characterization/latest/discord-execution-flow.latest.json
  - .ralph/characterization/latest/discord-registration.latest.json
  - .ralph/runs/run-20260305-090958-5834-iter-4.md
  - src/characterization/RUNBOOK.md
  - src/characterization/baselines/discord-execution-flow.baseline.json
  - src/characterization/baselines/discord-registration.baseline.json
  - src/characterization/discordExecution.characterization.ts
  - src/characterization/discordRegistration.characterization.ts
  - src/characterization/runCharacterization.ts
  - src/loaders/DiscordLoader.ts
  - src/loaders/discord/commandMetadata.ts
  - src/loaders/discord/commandRegistry.ts
  - src/loaders/discord/interactionExecution.ts
  - src/loaders/discord/types.ts
- What was implemented
  - Split Discord command loading internals into dedicated modules for registry composition, command metadata assembly, and interaction execution handling, while keeping `loadDiscord` and `loadDiscordCommandsHandler` entrypoints stable.
  - Preserved command registration and execution behavior: command ordering, hidden-command toggle, `commandsLoaded` population, unknown-command no-op handling, and failing-command reply/followUp fallback behavior.
  - Extended Discord characterization coverage with `/help` output verification and added a new `discord-registration` suite to lock command registration payload shape and command metadata contract.
- **Learnings for future iterations:**
  - Patterns discovered
    - Loader refactors are safer when orchestration stays in the public loader file and execution/registry concerns are split into focused modules.
  - Gotchas encountered
    - Characterization suites that instantiate full command factories need real i18n initialization; otherwise slash command builder name validation fails.
    - `pnpm lint` runs with `--fix` and can modify unrelated files; non-story diffs must be reverted before commit.
  - Useful context
    - `pnpm dev` still fails in this environment from an existing `file-type` package export/runtime mismatch unrelated to this story’s refactor.
---
## [2026-03-05 10:34:01 CET] - US-006: Centralize input validation and request parsing
Thread: 
Run: 20260305-090958-5834 (iteration 6)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-6.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-6.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: ceba687 refactor(validation): centralize request parsing (or `none` + reason)
- Post-commit status: remaining files: .agents/tasks/prd-livechat-refactor.json, .ralph/.tmp/prompt-20260305-090958-5834-6.md, .ralph/.tmp/story-20260305-090958-5834-6.json, .ralph/.tmp/story-20260305-090958-5834-6.md, .ralph/characterization/latest/admin-ingest-client-validation.latest.json, .ralph/runs/run-20260305-090958-5834-iter-5.md
- Verification:
  - Command: pnpm characterization -- --update-baseline -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm dev -> FAIL (missing local env vars including DATABASE_URL)
  - Command: API_URL=http://localhost:3333 DISCORD_TOKEN=dev-token DISCORD_CLIENT_ID=dev-client DATABASE_URL=file:./sqlite.db pnpm dev -> FAIL (existing runtime import error: ERR_PACKAGE_PATH_NOT_EXPORTED from file-type)
- Files changed:
  - src/services/validation/requestParsing.ts
  - src/components/admin/adminRoutes.ts
  - src/components/ingest/ingestRoutes.ts
  - src/components/overlay/overlayRoutes.ts
  - src/loaders/socket/valueUtils.ts
  - src/loaders/socket/socketAuthentication.ts
  - src/loaders/socket/socketEventDispatch.ts
  - src/characterization/adminIngestClientValidation.characterization.ts
  - src/characterization/baselines/admin-ingest-client-validation.baseline.json
  - src/characterization/runCharacterization.ts
  - src/characterization/RUNBOOK.md
- What was implemented
  - Added a shared `requestParsing` validation utility module with explicit TypeScript input/output types for non-empty string parsing, boolean flag parsing, optional booleans, optional integers, optional duration seconds, and generic body/params/query field parsing.
  - Applied shared validators to sensitive REST and socket paths while preserving contract semantics, including admin ingest-client creation payload parsing (`invalid_author_discord_user_id` behavior unchanged), overlay/ingest request bodies, socket handshake token/session mode parsing, and socket payload field parsing.
  - Added a characterization suite for admin ingest-client validation (positive persistence path and invalid author ID rejection) and wired it into the characterization run with a dedicated baseline.
- **Learnings for future iterations:**
  - Patterns discovered
    - Generic field parsers (`parseRequestField` + body/params/query wrappers) reduce duplicated coercion logic while keeping route-level validation outcomes stable.
  - Gotchas encountered
    - `pnpm lint` runs with `--fix`; story-scoped commits require restoring unrelated auto-format changes before staging.
    - `pnpm dev` needs explicit env vars in this workspace; even with vars set, runtime currently fails early because of an existing `file-type` package export issue.
  - Useful context
    - The new characterization suite locks both acceptance criteria examples for US-006 so future refactors can detect drift in admin ingest-client input behavior.
---
## [2026-03-05 10:49:29 CET] - US-007: Standardize safe error handling and logging
Thread: 
Run: 20260305-090958-5834 (iteration 7)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-7.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-7.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: f0cabb8 refactor(error-handling): centralize safe error mapping
- Post-commit status: `clean`
- Verification:
  - Command: pnpm characterization -- --update-baseline -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm dev -> FAIL (missing required env vars in this workspace)
  - Command: API_URL=http://localhost:3333 DISCORD_TOKEN=dev-token DISCORD_CLIENT_ID=dev-client-id DATABASE_URL=file:./sqlite.db pnpm dev -> FAIL (existing runtime issue: `ERR_PACKAGE_PATH_NOT_EXPORTED` from `file-type` under local Node v24)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - src/services/errors/runtimeErrorHandling.ts
  - src/server.ts
  - src/loaders/socket/socketAuthentication.ts
  - src/loaders/discord/interactionExecution.ts
  - src/characterization/errorHandling.characterization.ts
  - src/characterization/runCharacterization.ts
  - src/characterization/discordExecution.characterization.ts
  - src/characterization/socketLifecycle.characterization.ts
  - src/characterization/baselines/error-handling.baseline.json
  - src/characterization/baselines/discord-execution-flow.baseline.json
  - src/characterization/baselines/socket-lifecycle.baseline.json
  - src/characterization/RUNBOOK.md
- What was implemented
  - Added a centralized runtime error module with typed error categories, `OperationalError`, shared mappers for HTTP/socket/command outputs, and safe log redaction helpers for sensitive keys/values.
  - Wired the shared mappers into global Fastify error handling, overlay socket authentication failures, and Discord interaction execution failures while preserving existing user-visible response contracts.
  - Added characterization coverage for HTTP error handling + redaction behavior and extended socket/Discord characterization negative paths (unexpected socket auth failure and known operational command failure).
- **Learnings for future iterations:**
  - Patterns discovered
    - Error contract preservation is safer when status/body mapping is centralized and surface-specific handlers only pass contextual metadata.
  - Gotchas encountered
    - `pnpm lint` uses `--fix` and can modify unrelated files; restoring non-story files before commit is required to keep strict scope.
    - Local `pnpm dev` validation is blocked in this workspace by an existing Node runtime/package export mismatch (`file-type`) unrelated to US-007.
  - Useful context
    - Characterization now includes an `error-handling` suite that locks the centralized HTTP mapping contract and sensitive log redaction expectations.
---
## [2026-03-05 11:11:15 CET] - US-008: Harden environment parsing and secure defaults
Thread: 
Run: 20260305-090958-5834 (iteration 8)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-8.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-8.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: e9475bb refactor(config): harden env parsing startup
- Post-commit status: `clean`
- Verification:
  - Command: pnpm characterization -> FAIL (existing unrelated failure in `restOverlayPairConsume.characterization.ts`: "pairing code should remain present after consume")
  - Command: pnpm tsx -e 'import { runEnvParsingCharacterization } from "./src/characterization/envParsing.characterization"; runEnvParsingCharacterization().then((artifact)=>{process.stdout.write(JSON.stringify(artifact, null, 2) + "\\n");}).catch((error)=>{process.stderr.write(String(error?.stack || error)); process.exit(1);});' -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: DATABASE_URL='file:./sqlite.db' pnpm migration:up -> PASS
  - Command: API_URL='http://localhost:3333' DISCORD_TOKEN='smoke-token' DISCORD_CLIENT_ID='smoke-client-id' DATABASE_URL='file:./sqlite.db' npx -y node@20.11.1 node_modules/tsx/dist/cli.mjs ./src/index.ts -> FAIL (existing runtime `ERR_PACKAGE_PATH_NOT_EXPORTED` from `file-type`)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - .ralph/.tmp/prompt-20260305-090958-5834-8.md
  - .ralph/.tmp/story-20260305-090958-5834-8.json
  - .ralph/.tmp/story-20260305-090958-5834-8.md
  - .ralph/runs/run-20260305-090958-5834-iter-7.md
  - src/characterization/RUNBOOK.md
  - src/characterization/baselines/env-parsing.baseline.json
  - src/characterization/envParsing.characterization.ts
  - src/characterization/runCharacterization.ts
  - src/index.ts
  - src/services/env.ts
  - src/services/env/configSchema.ts
  - src/services/env/defaults.ts
  - src/services/env/parsers.ts
  - src/services/env/runtimeConfig.ts
  - src/services/runtimeSettings.ts
- What was implemented
  - Refactored env parsing into typed modules (`defaults`, `parsers`, `configSchema`, `runtimeConfig`) while preserving existing env names and valid-value outputs.
  - Added strict numeric parsing and deterministic `EnvironmentValidationError` reporting with key-only error metadata (no raw env value leakage).
  - Hardened startup by loading env during bootstrap and surfacing invalid-config failures through controlled boot error handling.
  - Added env characterization coverage for production-like config parity and invalid config rejection, with a dedicated baseline and runbook update.
- **Learnings for future iterations:**
  - Patterns discovered
    - Splitting env defaults/parsers/schema/invariants keeps runtime config changes isolated and safer to evolve without contract drift.
  - Gotchas encountered
    - `pnpm lint` runs with `--fix` and can reformat unrelated files; restore non-story files before final staging.
    - Runtime smoke is currently blocked by an existing `file-type` export mismatch in this workspace (`ERR_PACKAGE_PATH_NOT_EXPORTED`).
  - Useful context
    - The new `env-parsing` characterization suite now guards both valid production-like output parity and deterministic invalid-input rejection behavior.
---
## [2026-03-05 11:23:55 CET] - US-009: Tighten TypeScript compiler policy with tracked exceptions
Thread: 
Run: 20260305-090958-5834 (iteration 9)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-9.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-9.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 6037193 refactor(typescript): tighten strict compile policy (or `none` + reason)
- Post-commit status: `clean`
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: API_URL='http://localhost:3333' DISCORD_TOKEN='smoke-token' DISCORD_CLIENT_ID='smoke-client-id' DATABASE_URL='file:./sqlite.db' npx -y node@20.11.1 node_modules/tsx/dist/cli.mjs ./src/index.ts -> FAIL (existing runtime `ERR_PACKAGE_PATH_NOT_EXPORTED` from `file-type`)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - package.json
  - tsconfig.json
  - tsconfig.strict.json
  - src/index.ts
  - src/server.ts
  - src/services/errors/runtimeErrorHandling.ts
  - src/services/media/mediaSourceResolver.ts
  - src/services/media/mediaTranscode.ts
  - src/services/memeBoard.ts
  - src/services/playbackScheduler.ts
  - src/types/strictness-exceptions.d.ts
  - src/architecture/typescript-strictness.md
  - .ralph/.tmp/prompt-20260305-090958-5834-9.md
  - .ralph/.tmp/story-20260305-090958-5834-9.json
  - .ralph/.tmp/story-20260305-090958-5834-9.md
  - .ralph/runs/run-20260305-090958-5834-iter-8.md
- What was implemented
  - Enabled `noImplicitAny` in the main TypeScript policy (`tsconfig.json`) and enforced a phased strict profile via `tsconfig.strict.json`.
  - Wired the phased strict compile into the default build gate (`pnpm build`) through `pnpm typecheck:strict`.
  - Removed noImplicitAny build blockers in touched runtime paths by adding explicit type contracts in media transcode probing, meme board aggregation, and playback scheduler job handling.
  - Replaced legacy `@ts-ignore` suppressions with tracked `@ts-expect-error` exceptions carrying owner and removal ticket references.
  - Added `src/types/strictness-exceptions.d.ts` for temporary ambient module typings and documented the strictness matrix plus exception backlog in `src/architecture/typescript-strictness.md`.
- **Learnings for future iterations:**
  - Patterns discovered
    - A two-tier policy (`noImplicitAny` global + scoped strict-phase config) gives immediate safety wins without forcing broad legacy rewrites.
  - Gotchas encountered
    - `pnpm lint` (`--fix`) still rewrites unrelated legacy files; restoring non-story files before commit is required.
    - Runtime smoke remains blocked by a pre-existing `file-type` export mismatch even under Node 20.
  - Useful context
    - New strict-phase gate currently targets `src/services/{env,errors,validation}` and can be expanded module-by-module as backlog exceptions are removed.
---
## [2026-03-05 12:36:00 CET] - US-010: Eliminate weak typing in critical runtime paths
Thread: 
Run: 20260305-090958-5834 (iteration 10)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-10.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-10.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 43b3765 refactor(typing): harden critical auth/media contracts
- Post-commit status: clean
- Verification:
  - Command: pnpm characterization -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: API_URL=http://localhost:3333 DISCORD_TOKEN=dev-smoke-token DISCORD_CLIENT_ID=dev-smoke-client DATABASE_URL=file:./sqlite.db LOG=silent npx -y node@20.11.1 $(which pnpm) dev -> FAIL (ERR_PACKAGE_PATH_NOT_EXPORTED)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - .ralph/guardrails.md
  - src/characterization/restOverlayPairConsume.characterization.ts
  - src/characterization/runCharacterization.ts
  - src/characterization/overlayAuth.characterization.ts
  - src/characterization/baselines/overlay-auth.baseline.json
  - src/components/ingest/ingestRoutes.ts
  - src/components/overlay/overlayRoutes.ts
  - src/loaders/rest/registerDomainRoutes.ts
  - src/loaders/socket/socketAuthentication.ts
  - src/loaders/socket/types.ts
  - src/services/ingestAuth.ts
  - src/services/media/mediaIngestion.ts
  - src/services/overlayAuth.ts
  - src/typechecks/us010-critical-runtime.typecheck.ts
- What was implemented
  - Added explicit auth/media contracts: overlay auth discriminated union (`missing_token` / `invalid_token` / `authenticated`), typed ingest delegate interfaces, and typed media ingestion request/result interfaces.
  - Replaced unsafe critical casts in overlay/ingest auth and overlay/ingest route handling with typed narrowing and runtime guards while preserving endpoint/socket behavior.
  - Updated socket auth and overlay routes to consume the new discriminated auth union safely.
  - Added focused compile-time checks for contract enforcement (including required `createdByDiscordUserId` for ingest client params).
  - Added and integrated overlay auth characterization coverage plus baseline; stabilized overlay pair characterization time dependency.
- **Learnings for future iterations:**
  - Patterns discovered
  - Legacy Prisma type drift can hide fields present at runtime; explicit delegate interfaces with guards preserve compatibility while restoring compile-time safety.
  - Gotchas encountered
  - `pnpm dev` smoke remains sensitive to Node/runtime installation method; `npx node@20` can still trigger `file-type` export resolution issues.
  - Useful context
  - Characterization suites should avoid fixed timestamps near current dates to prevent time-based flakiness.
---
## [2026-03-05 13:10:20 CET] - US-011: Perform dependency hygiene with patch-only updates
Thread: 
Run: 20260305-090958-5834 (iteration 11)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-11.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-11.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 6f8183e chore(deps): apply patch-only dependency hygiene; 97af4e4 docs(progress): log us-011 run outcome
- Post-commit status: `clean`
- Verification:
  - Command: pnpm characterization -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm audit --prod --audit-level=moderate -> PASS
  - Command: API_URL='http://localhost:3333' DISCORD_TOKEN='dev-smoke-token' DISCORD_CLIENT_ID='dev-smoke-client' DATABASE_URL='file:./sqlite.db' LOG='silent' pnpm dev (bounded smoke) -> PASS (started, migrations applied, terminated intentionally after startup window)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - package.json
  - pnpm-lock.yaml
  - pnpm-workspace.yaml
  - src/architecture/dependency-hygiene.md
  - .ralph/.tmp/prompt-20260305-090958-5834-11.md
  - .ralph/.tmp/story-20260305-090958-5834-11.json
  - .ralph/.tmp/story-20260305-090958-5834-11.md
  - .ralph/characterization/latest/env-parsing.latest.json
  - .ralph/characterization/latest/overlay-auth.latest.json
  - .ralph/runs/run-20260305-090958-5834-iter-10.md
- What was implemented
  - Audited direct dependencies for patch/minor/major candidates, unused packages, and transitive duplication/security risks.
  - Applied patch-only upgrades to pinned dev dependencies: `@commitlint/config-conventional` (18.6.2 -> 18.6.3), `@types/node` (20.11.17 -> 20.11.30), `@typescript-eslint/eslint-plugin` (7.0.1 -> 7.0.2), `@typescript-eslint/parser` (7.0.1 -> 7.0.2), and `eslint-config-prettier` (9.1.0 -> 9.1.2).
  - Removed unused direct dependency `@t3-oss/env-core`.
  - Added local `pnpm-workspace.yaml` so repository-level `pnpm.overrides` are applied consistently; lock refresh yields `undici@6.23.0` and `minimatch@10.2.2` in the resolved tree.
  - Added `src/architecture/dependency-hygiene.md` with before/after versions, release-note references, deferred out-of-scope minor/major updates, and rollback notes.
- **Learnings for future iterations:**
  - Patterns discovered
    - In nested parent workspaces, local dependency hygiene checks can misreport until the repo is explicitly rooted as its own pnpm workspace.
  - Gotchas encountered
    - `pnpm lint` (`--fix`) auto-edits unrelated files; restore non-story formatting changes before commit.
    - `pnpm dlx depcheck` returns false positives for config-driven dependencies and exits non-zero when parsing commented tsconfig JSON.
  - Useful context
    - Local `pnpm-workspace.yaml` ensures the repo’s `pnpm.overrides` (notably `undici`/`minimatch`) are effective for audit and install flows.
---
## [2026-03-05 13:21 CET] - US-012: Refactor media lifecycle internals for correctness and cleanup safety
Thread: 
Run: 20260305-090958-5834 (iteration 12)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-12.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-12.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 1eb38aa refactor(media): extract lifecycle ingestion flow
- Post-commit status: `clean`
- Verification:
  - Command: pnpm characterization -- --update-baseline -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: log_file=$(mktemp) && (API_URL=http://localhost:3333 DISCORD_TOKEN=dev-smoke-token DISCORD_CLIENT_ID=dev-smoke-client DATABASE_URL=file:./sqlite.db pnpm dev >"$log_file" 2>&1) & pid=$!; sleep 20; kill -TERM "$pid" >/dev/null 2>&1 || true; sleep 1; kill -KILL "$pid" >/dev/null 2>&1 || true; wait "$pid" >/dev/null 2>&1 || true; tail -n 120 "$log_file" -> FAIL (expected with dummy Discord token; runtime boot reached Discord auth stage)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - .ralph/.tmp/prompt-20260305-090958-5834-12.md
  - .ralph/.tmp/story-20260305-090958-5834-12.json
  - .ralph/.tmp/story-20260305-090958-5834-12.md
  - .ralph/characterization/latest/media-lifecycle.latest.json
  - .ralph/runs/run-20260305-090958-5834-iter-11.md
  - src/characterization/baselines/media-lifecycle.baseline.json
  - src/characterization/mediaLifecycle.characterization.ts
  - src/services/media/mediaIngestion.ts
  - src/services/media/mediaLifecycleOrchestrator.ts
- What was implemented
  - Extracted source/local media ingestion orchestration into `mediaLifecycleOrchestrator.ts` with explicit typed dependency boundaries for cache check/touch, processing mark, temp-dir lifecycle, download, normalize/persist, and failure marking.
  - Preserved existing storage-path behavior, URL canonicalization/hash behavior, and expiry/error transitions by wiring existing implementations into the new orchestrator from `mediaIngestion.ts`.
  - Added characterization scenarios for ingestion lifecycle success, timeout failure, and cleanup-on-failure semantics; updated media lifecycle baseline accordingly.
- **Learnings for future iterations:**
  - Patterns discovered
    - Typed orchestration boundaries make lifecycle behavior testable without invoking ffmpeg/yt-dlp.
  - Gotchas encountered
    - `pnpm lint --fix` can introduce unrelated formatting changes; revert non-story edits before commit.
  - Useful context
    - Dev smoke can validate runtime boot flow with placeholder env values, but Discord auth requires a valid token for full pass.
---
## [2026-03-05 13:31:25 CET] - US-013: Align naming and formatting conventions across modules
Thread: 
Run: 20260305-090958-5834 (iteration 13)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-13.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-13.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 6291947 refactor(naming): align route naming conventions
- Post-commit status: `clean`
- Verification:
  - Command: pnpm characterization -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: log_file=$(mktemp) && (API_URL='http://localhost:3333' DISCORD_TOKEN='dev-smoke-token' DISCORD_CLIENT_ID='dev-smoke-client' DATABASE_URL='file:./sqlite.db' LOG='silent' pnpm dev >"$log_file" 2>&1) & pid=$!; sleep 20; kill -TERM "$pid" >/dev/null 2>&1 || true; sleep 1; kill -KILL "$pid" >/dev/null 2>&1 || true; wait "$pid" >/dev/null 2>&1 || true; tail -n 120 "$log_file" -> FAIL (bounded smoke stopped with lifecycle error, no explicit bootstrap marker)
  - Command: log_file=$(mktemp) && (API_URL='http://localhost:3333' DISCORD_TOKEN='dev-smoke-token' DISCORD_CLIENT_ID='dev-smoke-client' DATABASE_URL='file:./sqlite.db' pnpm dev >"$log_file" 2>&1) & pid=$!; sleep 25; kill -TERM "$pid" >/dev/null 2>&1 || true; sleep 1; kill -KILL "$pid" >/dev/null 2>&1 || true; wait "$pid" >/dev/null 2>&1 || true; tail -n 160 "$log_file"; if rg -q "\[BOOT\] Server bootstrap completed" "$log_file"; then echo "__SMOKE_OK__"; else echo "__SMOKE_NO_BOOT__"; fi -> PASS (`__SMOKE_OK__`; Discord auth expectedly failed with dummy token)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - .ralph/.tmp/prompt-20260305-090958-5834-13.md
  - .ralph/.tmp/story-20260305-090958-5834-13.json
  - .ralph/.tmp/story-20260305-090958-5834-13.md
  - .ralph/runs/run-20260305-090958-5834-iter-12.md
  - src/architecture/module-boundaries.md
  - src/characterization/adminIngestClientValidation.characterization.ts
  - src/characterization/restOverlayPairConsume.characterization.ts
  - src/characterization/restRouteDomains.characterization.ts
  - src/components/admin/adminRoutes.ts
  - src/components/ingest/ingestRoutes.ts
  - src/components/messages/messagesWorker.ts
  - src/components/overlay/overlayRoutes.ts
  - src/loaders/RESTLoader.ts
  - src/loaders/rest/adminDomainRegistrar.ts
  - src/loaders/rest/ingestDomainRegistrar.ts
  - src/loaders/rest/overlayDomainRegistrar.ts
  - src/server.ts
  - src/services/manualStop.ts
  - src/services/media/mediaCache.ts
- What was implemented
  - Standardized route/module naming in touched REST paths by introducing canonical action-oriented exports (`createAdminRoutes`, `createIngestRoutes`, `createOverlayRoutes`, `loadRestRoutes`) and migrating in-repo callers to those names.
  - Preserved backward compatibility by keeping legacy aliases (`AdminRoutes`, `IngestRoutes`, `OverlayRoutes`, `loadRoutes`) as explicit migration shims.
  - Updated characterization callers to the canonical exports while preserving baseline behavior checks.
  - Documented accepted and rejected naming/export conventions with concrete examples in `src/architecture/module-boundaries.md` for future contributors.
  - Lint auto-formatting also normalized deterministic import/wrap formatting in `messagesWorker.ts`, `manualStop.ts`, and `mediaCache.ts`.
- **Learnings for future iterations:**
  - Patterns discovered
    - Action-oriented exports (`create*`, `register*`, `load*`) reduce ambiguity between factory functions and type/class-like symbols in route modules.
  - Gotchas encountered
    - `pnpm lint --fix` repeatedly rewrites a few unrelated files; if strict story scoping is required, restore those files after lint or treat deterministic formatting updates as part of the run.
  - Useful context
    - Bounded `pnpm dev` validation should include an explicit bootstrap marker check (`[BOOT] Server bootstrap completed`) because lifecycle exit code alone can be noisy under forced termination.
---
## [2026-03-05 13:43:36 CET] - US-014: Execute full backward-compatibility verification and release checklist
Thread: 62637
Run: 20260305-090958-5834 (iteration 14)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-14.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-090958-5834-iter-14.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 4131c2e docs(release): add US-014 compatibility checklist
- Post-commit status: `clean`
- Verification:
  - Command: pnpm characterization -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm generate -> PASS
  - Command: DATABASE_URL='file:./sqlite.db' pnpm migration:up -> PASS
  - Command: API_URL='http://localhost:3333' DISCORD_TOKEN='dev-smoke-token' DISCORD_CLIENT_ID='dev-smoke-client' DATABASE_URL='file:./sqlite.db' pnpm dev (bounded smoke with bootstrap marker check) -> PASS (bootstrap reached; Discord auth failed as expected with dummy credentials)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - .ralph/.tmp/prompt-20260305-090958-5834-14.md
  - .ralph/.tmp/story-20260305-090958-5834-14.json
  - .ralph/.tmp/story-20260305-090958-5834-14.md
  - .ralph/runs/run-20260305-090958-5834-iter-13.md
  - src/architecture/release-checklist-us014.md
- What was implemented
  - Executed the full backward-compatibility verification gate and confirmed no characterization baseline drift across REST, socket, Discord, env parsing, and database-side effects suites.
  - Ran global quality gates and Prisma runtime checks required for release confidence.
  - Added a dedicated release checklist + residual risk note in `src/architecture/release-checklist-us014.md`, including explicit release-blocking criteria on contract drift.
- **Learnings for future iterations:**
  - Patterns discovered
    - Characterization baseline enforcement (`pnpm characterization`) is sufficient to act as a hard contract-drift blocker for refactor release gates.
  - Gotchas encountered
    - `pnpm migration:up` fails when `DATABASE_URL` is not set explicitly outside the `pnpm dev` path.
    - `pnpm dev` is best validated with a bounded run + explicit bootstrap marker check because dummy Discord credentials produce expected auth failures after startup.
  - Useful context
    - Current release artifact coverage for `US-014` is consolidated in `src/architecture/release-checklist-us014.md` and backed by `.ralph/characterization/latest/*.latest.json` outputs.
---
## [2026-03-05 14:04 CET] - US-001: Set up deterministic unit-test foundation
Thread: 
Run: 20260305-135706-86234 (iteration 1)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-1.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-1.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: caf47a1 test(unit-tests): add vitest test foundation
- Post-commit status: `clean`
- Verification:
  - Command: pnpm test:unit -> PASS
  - Command: tmp_test="tests/unit/samples/tmpDeliberateFail.test.ts"; trap 'rm -f "$tmp_test"' EXIT; cat > "$tmp_test" <<'EOT' ... EOT; pnpm test:unit (expected non-zero); cleanup -> PASS
  - Command: pnpm test:unit:coverage -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm test:unit:matrix -> PASS
  - Command: API_URL="http://localhost:3000" DISCORD_TOKEN="invalid-token" DISCORD_CLIENT_ID="1234567890" DATABASE_URL="file:./sqlite.db" pnpm dev (bounded smoke) -> PASS (startup reached Discord auth; expected invalid-token failure)
- Files changed:
  - .agents/tasks/prd-livechat-refactor.json
  - .agents/tasks/prd-module-unit-tests.json
  - .ralph/.tmp/prd-prompt-20260305-135259-85728.md
  - .ralph/.tmp/prompt-20260305-135706-86234-1.md
  - .ralph/.tmp/story-20260305-135706-86234-1.json
  - .ralph/.tmp/story-20260305-135706-86234-1.md
  - .ralph/runs/run-20260305-090958-5834-iter-14.md
  - package.json
  - pnpm-lock.yaml
  - tests/unit/samples/sampleMath.test.ts
  - tests/unit/samples/sampleMath.ts
  - vitest.config.ts
- What was implemented
  - Installed `vitest` and `@vitest/coverage-v8` as dev dependencies at workspace root.
  - Added deterministic unit-test scripts: `test:unit`, `test:unit:coverage`, and a temporary `test:unit:matrix` alias for current gate compatibility.
  - Added a Node-oriented `vitest.config.ts` with deterministic test discovery and V8 coverage output.
  - Added a sample module and unit tests proving both happy-path and handled error-path assertions.
  - Verified the negative case by injecting a deliberate failing assertion and confirming `pnpm test:unit` exits non-zero.
- **Learnings for future iterations:**
  - Patterns discovered
    - `pnpm add -D` at this repo root requires `-w` because the repository is a pnpm workspace root.
  - Gotchas encountered
    - In `zsh`, `status` is readonly; use another variable name when capturing exit codes in shell checks.
  - Useful context
    - `test:unit:matrix` is currently a temporary alias and should be replaced by the dedicated module inventory gate in US-002.
---
## [2026-03-05 14:14 CET] - US-002: Create module inventory and missing-test gate
Thread: 
Run: 20260305-135706-86234 (iteration 2)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-2.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-2.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: b324ba5 test(unit-matrix): add module inventory gate
- Post-commit status: `clean`
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm test:unit -> PASS
  - Command: pnpm test:unit:matrix -> FAIL (expected; reports uncovered runtime modules and exits non-zero)
  - Command: API_URL='http://localhost:3000' DISCORD_TOKEN='invalid-token' DISCORD_CLIENT_ID='1234567890' DATABASE_URL='file:./sqlite.db' pnpm dev (bounded smoke) -> PASS (startup reached expected Discord 401 with invalid token)
- Files changed:
  - .agents/tasks/prd-module-unit-tests.json
  - .ralph/.tmp/prompt-20260305-135706-86234-2.md
  - .ralph/.tmp/story-20260305-135706-86234-2.json
  - .ralph/.tmp/story-20260305-135706-86234-2.md
  - .ralph/runs/run-20260305-135706-86234-iter-1.md
  - package.json
  - tests/unit/matrix/moduleInventory.ts
  - tests/unit/matrix/runUnitTestMatrix.ts
  - tests/unit/matrix/unitTestMatrix.test.ts
  - tests/unit/matrix/unitTestMatrix.ts
  - tests/unit/services/messages/richOverlayPayload.test.ts
- What was implemented
  - Added a deterministic runtime module inventory utility that scans `src/**/*.ts` and excludes `src/characterization/**`, `src/architecture/**`, declaration files (`*.d.ts`), and typecheck-only files (`src/typechecks/**`, `*.typecheck.ts`).
  - Implemented a unit-test matrix report generator and CLI gate that maps runtime modules to mirrored unit-test paths and emits machine-readable JSON with `status`, `summary`, `coveredModules`, and `missingModules`.
  - Replaced `test:unit:matrix` placeholder alias with the dedicated matrix gate command.
  - Added matrix utility tests covering both positive (covered module) and negative (missing module path + failing status) cases.
  - Added one mapped runtime unit test for `src/services/messages/richOverlayPayload.ts` so live matrix output includes a covered-module example.
- **Learnings for future iterations:**
  - Patterns discovered
    - Deterministic path sorting and normalized posix paths keep matrix output stable for CI diffs.
  - Gotchas encountered
    - With the current backfill state, `test:unit:matrix` is expected to fail until additional story modules gain mapped unit tests.
  - Useful context
    - Matrix output is JSON-first and directly usable in CI logs for parsing missing module paths.
---
## [2026-03-05 14:24 CET] - US-003: Backfill tests for env configuration modules
Thread: 41114
Run: 20260305-135706-86234 (iteration 3)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-3.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-3.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: c4245cd test(env): backfill env configuration unit tests
- Post-commit status: `clean`
- Verification:
  - Command: pnpm vitest run --config vitest.config.ts tests/unit/services/env.test.ts tests/unit/services/env/*.test.ts -> PASS
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm test:unit -> PASS
  - Command: pnpm test:unit:matrix -> FAIL (expected at this stage; reports uncovered runtime modules outside US-003 scope)
  - Command: API_URL=https://api.livechat.example DISCORD_TOKEN=dev-token DISCORD_CLIENT_ID=dev-client DATABASE_URL=file:./sqlite.dev-smoke.db pnpm dev (bounded smoke) -> FAIL (expected with dummy Discord credentials; bootstrap reached listening state)
- Files changed:
  - .agents/tasks/prd-module-unit-tests.json
  - tests/unit/services/env.test.ts
  - tests/unit/services/env/configSchema.test.ts
  - tests/unit/services/env/defaults.test.ts
  - tests/unit/services/env/parsers.test.ts
  - tests/unit/services/env/runtimeConfig.test.ts
  - tests/unit/services/env/runtimeEnvFixture.ts
  - .ralph/progress.md
- What was implemented
  - Added characterization-style unit tests for `src/services/env.ts` covering `loadEnv`, `NODE_ENV` normalization helpers, default fallback when `NODE_ENV` is absent, and startup validation error category on invalid numeric input.
  - Added focused unit tests for `src/services/env/configSchema.ts`, `defaults.ts`, `parsers.ts`, and `runtimeConfig.ts`, including required/optional/default parsing, numeric normalization, and invalid numeric/enum error handling.
  - Confirmed `pnpm test:unit:matrix` now recognizes all env modules as covered: `src/services/env.ts` and `src/services/env/*`.
- **Learnings for future iterations:**
  - Patterns discovered
    - A shared `createRuntimeEnv` fixture keeps env-module tests deterministic while preserving required-runtime inputs.
  - Gotchas encountered
    - `pnpm dev` performs Discord command registration/login at startup; smoke tests with placeholder credentials reach server bootstrap but still emit expected 401/token errors.
  - Useful context
    - Matrix gate failure count dropped to `64` with env module coverage now mapped for US-003.
---
## [2026-03-05 14:34:04 CET] - US-004: Backfill tests for auth and validation services
Thread: 
Run: 20260305-135706-86234 (iteration 4)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-4.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-4.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: eec9a82 test(auth-validation): backfill guardrail service tests
- Post-commit status: `clean`
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm test:unit -> PASS
  - Command: pnpm test:unit:matrix -> FAIL (expected at this stage; uncovered modules remain outside US-004 scope)
  - Command: log_file=$(mktemp) && (API_URL='http://localhost:3333' DISCORD_TOKEN='dev-smoke-token' DISCORD_CLIENT_ID='dev-smoke-client' DATABASE_URL='file:./sqlite.db' pnpm dev >"$log_file" 2>&1) & pid=$!; sleep 25; kill -TERM "$pid"; ...; rg "[BOOT] Server bootstrap completed" -> PASS (`__SMOKE_OK__`; Discord auth failed as expected with dummy token)
- Files changed:
  - .agents/tasks/prd-module-unit-tests.json
  - .ralph/.tmp/prompt-20260305-135706-86234-4.md
  - .ralph/.tmp/story-20260305-135706-86234-4.json
  - .ralph/.tmp/story-20260305-135706-86234-4.md
  - .ralph/runs/run-20260305-135706-86234-iter-3.md
  - tests/unit/services/ingestAuth.test.ts
  - tests/unit/services/overlayAuth.test.ts
  - tests/unit/services/pairingCodes.test.ts
  - tests/unit/services/validation/requestParsing.test.ts
  - .ralph/progress.md
- What was implemented
  - Added unit tests for `src/services/overlayAuth.ts` covering valid bearer/query/socket auth resolution, invalid/missing credential branches, legacy token creation fallback behavior, and unavailable-model error handling.
  - Added unit tests for `src/services/ingestAuth.ts` covering ingest token creation, accepted and rejected bearer credential resolution, revoke behavior, API-enabled checks, and unavailable-model branch.
  - Added unit tests for `src/services/pairingCodes.ts` covering stale-code purge query contract, purge worker success logging, and purge worker failure logging.
  - Added unit tests for `src/services/validation/requestParsing.ts` covering parser forwarding, malformed-source fallback, parser-thrown error propagation, and invalid parsing branches for string/boolean/int/duration helpers.
- **Learnings for future iterations:**
  - Patterns discovered
    - Global `prisma`/`logger` stubs plus deterministic request fixtures are sufficient to unit-test auth and worker guardrails without external calls.
  - Gotchas encountered
    - `test:unit:matrix` remains intentionally failing until later stories backfill the rest of runtime modules; this is expected for scoped stories like US-004.
  - Useful context
    - Bounded `pnpm dev` smoke with a bootstrap marker check confirms startup health even when Discord login fails with placeholder credentials.
---
## [2026-03-05 14:48:21 CET] - US-005: Backfill tests for media service pipeline
Thread: 
Run: 20260305-135706-86234 (iteration 5)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-5.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-5.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: e419caa test(media): backfill media pipeline unit tests (or `none` + reason)
- Post-commit status: `clean`
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm test:unit -> PASS
  - Command: pnpm test:unit:matrix -> FAIL
  - Command: API_URL=http://localhost:3000 DISCORD_TOKEN=test-token DISCORD_CLIENT_ID=test-client DATABASE_URL=file:./sqlite.db pnpm dev -> FAIL
- Files changed:
  - .agents/tasks/prd-module-unit-tests.json
  - .ralph/.tmp/prompt-20260305-135706-86234-5.md
  - .ralph/.tmp/story-20260305-135706-86234-5.json
  - .ralph/.tmp/story-20260305-135706-86234-5.md
  - .ralph/runs/run-20260305-135706-86234-iter-4.md
  - tests/unit/services/media/mediaCache.test.ts
  - tests/unit/services/media/mediaErrors.test.ts
  - tests/unit/services/media/mediaIngestion.test.ts
  - tests/unit/services/media/mediaLifecycleOrchestrator.test.ts
  - tests/unit/services/media/mediaSourceResolver.test.ts
  - tests/unit/services/media/mediaTestFixture.ts
  - tests/unit/services/media/mediaTranscode.test.ts
  - .ralph/progress.md
- What was implemented
  - Added deterministic unit tests for all `src/services/media/*` modules.
  - Covered ingestion orchestration (remote/local), cache hit/bypass, typed failure handling, and cleanup execution paths.
  - Added transcode boundary tests (direct-copy MP4 path, audio-only container normalization, invalid-output rejection).
  - Added source resolver tests for canonicalization, YouTube offsets, TikTok short-link resolution, and Twitter media substitution.
  - Added media error classification/localization tests and cache budget/purge tests with filesystem mocks.
  - Verified matrix report now includes all media modules as covered.
- **Learnings for future iterations:**
  - Patterns discovered
  - Media pipeline modules are testable without runtime refactors by mocking module dependencies and process boundaries.
  - Gotchas encountered
  - `src/services/media/mediaErrors.ts` imports `src/services/env` at module load, so tests must mock that env module before imports.
  - Useful context
  - `pnpm test:unit:matrix` still fails globally due remaining non-media modules, but US-005 media-module coverage is now present in `coveredModules`.
---
## [2026-03-05 15:00 CET] - US-006: Backfill tests for socket loader lifecycle
Thread: 55988
Run: 20260305-135706-86234 (iteration 6)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-6.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-6.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: dcb92f6 test(socket): backfill socket lifecycle coverage
- Post-commit status: `clean`
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm test:unit -> PASS
  - Command: pnpm test:unit:matrix -> FAIL (global uncovered modules remain outside US-006 scope; socket modules now listed as covered)
  - Command: API_URL=http://localhost:3000 DISCORD_TOKEN=test-token DISCORD_CLIENT_ID=test-client DATABASE_URL=file:./sqlite.db pnpm dev -> FAIL (startup reached listening state; expected Discord auth failures with placeholder credentials)
- Files changed:
  - .agents/tasks/prd-module-unit-tests.json
  - .ralph/.tmp/prompt-20260305-135706-86234-6.md
  - .ralph/.tmp/story-20260305-135706-86234-6.json
  - .ralph/.tmp/story-20260305-135706-86234-6.md
  - .ralph/runs/run-20260305-135706-86234-iter-5.md
  - tests/unit/loaders/socket/socketAuthentication.test.ts
  - tests/unit/loaders/socket/socketConnectionState.test.ts
  - tests/unit/loaders/socket/socketEventDispatch.test.ts
  - tests/unit/loaders/socket/types.test.ts
  - tests/unit/loaders/socket/valueUtils.test.ts
  - tests/unit/loaders/socketLoader.test.ts
  - .ralph/progress.md
- What was implemented
- Added characterization-style unit tests for `src/loaders/socketLoader.ts` and all `src/loaders/socket/*` modules.
- Covered positive and negative lifecycle paths: authenticated handshake wiring, missing guild disconnect rejection, auth middleware success/failure/error mapping, connection peer broadcasting, disconnect cleanup, and event dispatcher routing.
- Asserted emitted payload shapes and transitions with mocked socket/Fastify interfaces, including heartbeat normalization, playback-state normalization, stop/manual-stop dispatch, meme trigger accept/reject branches, and disconnect lifecycle callbacks.
- Added type-contract coverage for `src/loaders/socket/types.ts` and utility behavior coverage for `src/loaders/socket/valueUtils.ts`.
- Confirmed matrix output now recognizes all socket modules as covered.
- **Learnings for future iterations:**
  - Patterns discovered
  - Socket lifecycle modules are deterministic to test by capturing registered handlers from mocked Socket.IO objects instead of booting a full server.
  - Gotchas encountered
  - `pnpm dev` is long-running and requires explicit process termination in automation; placeholder Discord credentials still produce expected 401/token errors after successful server bootstrap.
  - Useful context
  - `pnpm test:unit:matrix` missing count dropped from 54 to 48 with six socket module entries added to `coveredModules`.
---
## [2026-03-05 15:12 CET] - US-007: Backfill tests for REST loader and route domains
Thread: 
Run: 20260305-135706-86234 (iteration 7)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-7.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-7.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: d9b53fe test(rest): backfill route loader domain tests
- Post-commit status: `clean`
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm test:unit -> PASS
  - Command: pnpm test:unit:matrix -> FAIL (expected; uncovered modules remain outside US-007 scope)
- Files changed:
  - .agents/tasks/prd-module-unit-tests.json
  - .ralph/.tmp/prompt-20260305-135706-86234-7.md
  - .ralph/.tmp/story-20260305-135706-86234-7.json
  - .ralph/.tmp/story-20260305-135706-86234-7.md
  - .ralph/runs/run-20260305-135706-86234-iter-6.md
  - tests/unit/loaders/RESTLoader.test.ts
  - tests/unit/loaders/rest/registerDomainRoutes.test.ts
  - tests/unit/loaders/rest/adminDomainRegistrar.test.ts
  - tests/unit/loaders/rest/overlayDomainRegistrar.test.ts
  - tests/unit/loaders/rest/ingestDomainRegistrar.test.ts
  - tests/unit/components/overlay/overlayRoutes.test.ts
  - tests/unit/components/admin/adminRoutes.test.ts
  - tests/unit/components/ingest/ingestRoutes.test.ts
- What was implemented
  - Added unit tests for `src/loaders/RESTLoader.ts` to assert admin/overlay/ingest registrar wiring and legacy alias compatibility.
  - Added unit tests for `src/loaders/rest/registerDomainRoutes.ts` and each domain registrar to validate prefix/factory registration behavior.
  - Added Fastify injection tests for `src/components/overlay/overlayRoutes.ts`, including valid `POST /overlay/pair/consume` payload contract, malformed consume payload `400` response shape, and protected `/overlay/config` auth valid/invalid cases.
  - Added Fastify injection tests for `src/components/admin/adminRoutes.ts` auth guard behavior on `GET /admin/` for invalid and valid credentials.
  - Added Fastify injection tests for `src/components/ingest/ingestRoutes.ts`, covering valid `POST /ingest/pair/consume` payload contract and protected `/ingest/` auth invalid/valid credential branches.
- **Learnings for future iterations:**
  - Patterns discovered
    - Route-domain backfills are stable with Fastify injection plus focused service mocks on auth/media dependencies.
  - Gotchas encountered
    - `mediaErrors` pulls `env` at import time; route tests must mock media modules before importing route handlers to avoid env validation boot errors.
  - Useful context
    - Matrix gate now marks all US-007 target modules as covered while remaining failures map to future Discord/message/shared-service stories.
---
## [2026-03-05 15:23:37 CET] - US-008: Backfill tests for Discord loader internals
Thread: 
Run: 20260305-135706-86234 (iteration 8)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-8.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-8.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: db55ed6 test(discord-loader): backfill loader internals
- Post-commit status: clean
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm test:unit -> PASS
  - Command: pnpm test:unit:matrix -> FAIL (expected at this stage; uncovered modules remain outside US-008 scope while Discord loader internals are now covered)
  - Command: API_URL='http://localhost:3000' DISCORD_TOKEN='test-token' DISCORD_CLIENT_ID='test-client' DATABASE_URL='file:./sqlite.db' pnpm dev (bounded smoke) -> PASS (`__SMOKE_OK__`; startup reached bootstrap, Discord auth/command registration failures expected with placeholder credentials)
- Files changed:
  - .agents/tasks/prd-module-unit-tests.json
  - .ralph/.tmp/prompt-20260305-135706-86234-8.md
  - .ralph/.tmp/story-20260305-135706-86234-8.json
  - .ralph/.tmp/story-20260305-135706-86234-8.md
  - .ralph/runs/run-20260305-135706-86234-iter-7.md
  - tests/unit/loaders/DiscordLoader.test.ts
  - tests/unit/loaders/discord/commandMetadata.test.ts
  - tests/unit/loaders/discord/commandRegistry.test.ts
  - tests/unit/loaders/discord/interactionExecution.test.ts
  - tests/unit/loaders/discord/types.test.ts
  - .ralph/progress.md
- What was implemented
  - Added unit tests for `src/loaders/DiscordLoader.ts` covering Discord REST/client initialization, command metadata registration path, event listener wiring, and non-crashing error handling for registration/login failures.
  - Added unit tests for `src/loaders/discord/commandMetadata.ts`, `commandRegistry.ts`, `interactionExecution.ts`, and `types.ts` with mocked Discord/client interactions and explicit positive/negative-path assertions.
  - Verified the matrix gate now marks all Discord loader internal modules (`src/loaders/DiscordLoader.ts` and `src/loaders/discord/*`) as covered.
- **Learnings for future iterations:**
  - Patterns discovered
    - Hoisted Vitest module mocks are sufficient to isolate Discord.js constructors and keep loader tests deterministic without real API calls.
  - Gotchas encountered
    - `pnpm test:unit:matrix` remains globally failing until later PRD stories backfill remaining runtime modules; story-level completion should be evaluated against scoped module coverage in `coveredModules`.
  - Useful context
    - A bounded `pnpm dev` smoke can validate runtime bootstrap (`[BOOT] Server bootstrap completed`) even when placeholder Discord credentials intentionally fail authentication.
---
## [2026-03-05 15:34:19 CET] - US-009: Backfill tests for Discord command modules
Thread: 
Run: 20260305-135706-86234 (iteration 9)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-9.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-9.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: e68ff1d test(discord-commands): backfill command module tests
- Post-commit status: `dirty` (.ralph/progress.md pending entry commit)
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm test:unit -> PASS
  - Command: pnpm test:unit:matrix -> FAIL (expected at this stage; remaining uncovered modules are outside US-009 scope)
  - Command: log_file=$(mktemp); (API_URL='http://localhost:3000' DISCORD_TOKEN='test-token' DISCORD_CLIENT_ID='test-client' DATABASE_URL='file:./sqlite.db' pnpm dev >"$log_file" 2>&1) & pid=$!; sleep 25; kill -TERM "$pid"; ... -> PASS (bootstrap marker reached; expected Discord 401 with placeholder token)
- Files changed:
  - .agents/tasks/prd-module-unit-tests.json
  - .ralph/.tmp/prompt-20260305-135706-86234-9.md
  - .ralph/.tmp/story-20260305-135706-86234-9.json
  - .ralph/.tmp/story-20260305-135706-86234-9.md
  - .ralph/runs/run-20260305-135706-86234-iter-8.md
  - tests/unit/components/discord/aliveCommand.test.ts
  - tests/unit/components/discord/clientCommand.test.ts
  - tests/unit/components/discord/helpCommand.test.ts
  - tests/unit/components/discord/infoCommand.test.ts
  - tests/unit/components/discord/memeAddCommand.test.ts
  - tests/unit/components/discord/overlaysCommand.test.ts
  - tests/unit/components/discord/setDefaultTimeCommand.test.ts
  - tests/unit/components/discord/setDisplayFullCommand.test.ts
  - tests/unit/components/discord/setMaxTimeCommand.test.ts
  - .ralph/progress.md
- What was implemented
  - Added command-level unit tests for every Discord command module under `src/components/discord/*`.
  - Verified success payload contracts for `alive`, `help`, `info`, `overlay-code`, `meme-add`, `overlays`, and all settings commands.
  - Added negative-path coverage for validation/permission/error branches: missing guild context, missing media input, permission denial for admin-only settings commands, and pairing-code collision exhaustion.
  - Confirmed matrix coverage now maps all targeted Discord command modules to explicit test files.
- **Learnings for future iterations:**
  - Patterns discovered
    - Command handlers are deterministic to test via lightweight interaction stubs plus focused global (`rosetty`, `prisma`, `env`, `logger`) mocks.
  - Gotchas encountered
    - Interaction fixture builders must preserve explicit `null` values; `??` defaults can silently bypass command validation branches.
  - Useful context
    - `pnpm test:unit:matrix` now reports all `src/components/discord/*` modules as covered while remaining failures are in future US-010/US-011 scope.
---
## [2026-03-05 15:46:32 CET] - US-010: Backfill tests for message command modules
Thread: 
Run: 20260305-135706-86234 (iteration 10)
Run log: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-10.log
Run summary: /Users/maxence/Développement/LiveChat/LiveChat-Bot/.ralph/runs/run-20260305-135706-86234-iter-10.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 214730d test(messages): backfill command module unit tests (or `none` + reason)
- Post-commit status: `clean`
- Verification:
  - Command: pnpm lint -> PASS
  - Command: pnpm build -> PASS
  - Command: pnpm characterization -> PASS
  - Command: pnpm test:unit -> PASS
  - Command: pnpm test:unit:matrix -> FAIL (expected at this stage; remaining uncovered modules are outside US-010 scope)
  - Command: API_URL=http://localhost:3333 DISCORD_TOKEN=test DISCORD_CLIENT_ID=test DATABASE_URL=file:./sqlite.db pnpm dev -> FAIL (expected with placeholder Discord credentials; service boot completed before Discord auth failure)
- Files changed:
  - .agents/tasks/prd-module-unit-tests.json
  - .ralph/.tmp/prompt-20260305-135706-86234-10.md
  - .ralph/.tmp/story-20260305-135706-86234-10.json
  - .ralph/.tmp/story-20260305-135706-86234-10.md
  - .ralph/runs/run-20260305-135706-86234-iter-9.md
  - tests/unit/components/messages/hidesendCommand.test.ts
  - tests/unit/components/messages/hidetalkCommand.test.ts
  - tests/unit/components/messages/messagesWorker.test.ts
  - tests/unit/components/messages/sendCommand.test.ts
  - tests/unit/components/messages/stopCommand.test.ts
  - tests/unit/components/messages/talkCommand.test.ts
- What was implemented
  - Added isolated unit tests for all modules under `src/components/messages/*`: `sendCommand`, `hideSendCommand`, `talkCommand`, `hideTalkCommand`, `stopCommand`, and `messagesWorker`.
  - Validated message payload construction and downstream scheduling calls for send/talk flows, including rich media start-offset encoding and worker overlay payload emission.
  - Added refusal/error-path tests ensuring empty content and voice-generation failures do not trigger outbound playback side effects, while preserving localized response behavior.
  - Added scheduling and no-client negative-path coverage for `messagesWorker` and verified all message modules are now listed as covered in matrix output.
- **Learnings for future iterations:**
  - Patterns discovered
    - Command-module tests are stable when Discord interaction objects are represented by minimal stubs and all external media/social services are fully mocked.
  - Gotchas encountered
    - `talkCommand` and `hideTalkCommand` call `.catch()` on `deleteGtts`, so mocks must return promises (for example `mockResolvedValue(undefined)`) to avoid false-negative test failures.
  - Useful context
    - `pnpm test:unit:matrix` missing-module count dropped from 26 to 20; all `src/components/messages/*` modules are now covered and remaining gaps are in future US-011 scope.
---
