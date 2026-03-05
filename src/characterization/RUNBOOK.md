# Characterization Runbook

This runbook defines the pre-refactor safety loop introduced for `US-001`.

## Scope Covered

`pnpm characterization` runs and verifies baselines for:
- REST domain contracts: `/overlay/config`, `/ingest/pair/consume`, `/admin/api/runtime-settings`, and unsupported path behavior
- REST contract: `POST /overlay/pair/consume` (valid + malformed payload)
- Admin ingest client contract: `POST /admin/api/ingest-clients` (valid payload persistence + invalid author id rejection)
- Socket lifecycle: overlay auth, connect/heartbeat/disconnect side effects, peers emission shape
- Discord command execution flow: unknown command path and failing command recovery path
- Discord command registration contract: command list and registration payload shape
- Media lifecycle: cache touch, non-persistent budget eviction, expired/stale purge behavior
- Runtime error handling: centralized HTTP mapping and sensitive log redaction behavior
- Environment parsing: production-like output parity and deterministic invalid-config rejection

Baselines are versioned in `src/characterization/baselines/*.baseline.json`.
Latest run artifacts are written to `.ralph/characterization/latest/*.latest.json`.

## Standard Pre-Slice Loop

1. Run characterization checks:
```bash
pnpm characterization
```
2. Run mandatory quality gates:
```bash
pnpm lint
pnpm build
```
3. If any suite fails, inspect the corresponding latest artifact in `.ralph/characterization/latest/` and either:
- fix the regression, or
- if behavior change is intentional and approved, update the baseline explicitly.

## Updating Baselines (Intentional/Approved Changes Only)

```bash
pnpm characterization -- --update-baseline
```

Then rerun the standard loop:
```bash
pnpm characterization
pnpm lint
pnpm build
```

## Notes

- Keep baselines behavior-focused (status codes, payload shapes, and critical side effects).
- Do not edit baselines manually when a suite is failing; regenerate with `--update-baseline` only after approving the behavior change.
