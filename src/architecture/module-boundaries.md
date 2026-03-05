# Module Boundaries and Compatibility Map (US-002)

## Purpose
Define a safe target module map for phased refactors while preserving all external behavior and entrypoints.

## External Compatibility Surfaces (Locked)
The following surfaces are compatibility-locked and cannot be moved/renamed in this story:
- Runtime entrypoints: `src/index.ts`, `src/server.ts`
- Loader public wiring: `src/loaders/RESTLoader.ts`, `src/loaders/socketLoader.ts`, `src/loaders/DiscordLoader.ts`
- REST contracts: `/overlay/pair/consume`, `/overlay/config`, `/overlay/temp/:transientMediaId`
- Socket event contracts from `@livechat/overlay-protocol`

## Full Module Map

### Entrypoints
- `src/index.ts`
- `src/server.ts`

### Loaders
- `src/loaders/RESTLoader.ts`
- `src/loaders/socketLoader.ts`
- `src/loaders/DiscordLoader.ts`

### Components
- `src/components/admin/*`
- `src/components/discord/*`
- `src/components/ingest/*`
- `src/components/messages/*`
- `src/components/overlay/*`

### Services
- Runtime/config: `src/services/env.ts`, `src/services/runtimeSettings.ts`, `src/services/i18n/*`
- Domain orchestration: `src/services/playbackScheduler.ts`, `src/services/playbackJobs.ts`, `src/services/manualStop.ts`, `src/services/pairingCodes.ts`, `src/services/memeBoard.ts`
- Auth/integration: `src/services/overlayAuth.ts`, `src/services/ingestAuth.ts`, `src/services/gtts.ts`, `src/services/social/*`
- Media pipeline: `src/services/media/*`
- Shared helpers: `src/services/utils.ts`, `src/services/discord-utils.ts`, `src/services/messages/richOverlayPayload.ts`

### Repositories
- Prisma repository internals (canonical path):
  - `src/repositories/prisma/loadPrisma.ts`
  - `src/repositories/prisma/prismaEnums.ts`

### Shared/Runtime Types
- `src/types/module.d.ts`

### Characterization
- `src/characterization/*`

## Dependency Directions
Approved dependency flow:
- `entrypoints -> loaders`
- `entrypoints -> services`
- `loaders -> components`
- `loaders -> services`
- `components -> services`
- `services -> repositories`
- `services -> services` (only for shared/domain helpers, never back up to components/loaders)

Prohibited dependency flow:
- `components -> loaders` or `components -> entrypoints`
- `services -> components` or `services -> loaders` or `services -> entrypoints`
- `repositories -> services` or `repositories -> components` or `repositories -> loaders`
- `characterization` code imported by runtime code

## Compatibility Re-export Map
Moved internal modules use wrappers for phased migration:

| Legacy path | Canonical path | Compatibility status |
| --- | --- | --- |
| `src/services/prisma/loadPrisma.ts` | `src/repositories/prisma/loadPrisma.ts` | Legacy file kept as `export *` wrapper |
| `src/services/prisma/prismaEnums.ts` | `src/repositories/prisma/prismaEnums.ts` | Legacy file kept as `export *` wrapper |

US-013 naming compatibility aliases (same file, canonical symbol change):

| Module | Canonical export | Legacy compatibility export | Status |
| --- | --- | --- | --- |
| `src/components/admin/adminRoutes.ts` | `createAdminRoutes` | `AdminRoutes` | Legacy alias kept, new code uses canonical export |
| `src/components/ingest/ingestRoutes.ts` | `createIngestRoutes` | `IngestRoutes` | Legacy alias kept, new code uses canonical export |
| `src/components/overlay/overlayRoutes.ts` | `createOverlayRoutes` | `OverlayRoutes` | Legacy alias kept, new code uses canonical export |
| `src/loaders/RESTLoader.ts` | `loadRestRoutes` | `loadRoutes` | Legacy alias kept, new code uses canonical export |

Compatibility example:

```ts
// Legacy import (still valid during migration)
import { loadPrismaClient } from './services/prisma/loadPrisma';
```

## Naming And Formatting Conventions (US-013)

Conventions applied and required in touched modules:

- File naming:
  - Runtime/internal modules use lower-camel filenames, for example `overlayRoutes.ts`, `registerDomainRoutes.ts`.
  - Compatibility-locked loader entry files remain unchanged (`RESTLoader.ts`, `DiscordLoader.ts`, `socketLoader.ts`).
- Symbol naming:
  - Factories: `create*` (`createOverlayRoutes`).
  - Registrars: `register*` (`registerOverlayDomainRoutes`).
  - Loaders: `load*` with explicit domain (`loadRestRoutes`).
- Export style:
  - Prefer named exports (`export const`, `export type`).
  - Avoid new default exports in runtime code.
  - Keep legacy aliases only as migration shims; do not use them in new imports.

Accepted examples:

```ts
import { createOverlayRoutes } from '../../components/overlay/overlayRoutes';
import { loadRestRoutes } from '../loaders/RESTLoader';
```

Rejected examples:

```ts
import { OverlayRoutes } from '../../components/overlay/overlayRoutes'; // legacy alias
import { loadRoutes } from '../loaders/RESTLoader'; // ambiguous loader scope
```

## Out-of-Scope Rejections (Negative Case)
The following proposed moves were explicitly rejected and logged as out of scope for US-002 because they would alter external entrypoints/contracts:
- Moving or renaming `src/index.ts` or `src/server.ts`
- Moving or renaming loader public files under `src/loaders/*`
- Changing externally consumed REST paths or Socket event names

## Validation Intent
This story defines boundaries plus compatibility shims only. No external route/event/env contract behavior is changed. Verification is performed through lint/build gates after the compatibility wrappers are introduced.
