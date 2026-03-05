# Guardrails (Signs)

> Lessons learned from failures. Read before acting.

## Core Signs

### Sign: Read Before Writing
- **Trigger**: Before modifying any file
- **Instruction**: Read the file first
- **Added after**: Core principle

### Sign: Test Before Commit
- **Trigger**: Before committing changes
- **Instruction**: Run required tests and verify outputs
- **Added after**: Core principle

---

## Learned Signs

### Sign: Use Project Node Version For Dev Smoke
- **Trigger**: Before running `pnpm dev` for runtime validation
- **Instruction**: Use Node `20.11.1` from `.node-version` and set `API_URL`, `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `DATABASE_URL`.
- **Added after**: Iteration 7 - repeated startup failures from missing env vars and Node 24 `ERR_PACKAGE_PATH_NOT_EXPORTED`.

### Sign: Avoid npx Node Wrapper For Dev Smoke
- **Trigger**: When attempting a Node 20 dev smoke via `npx node@20.x`
- **Instruction**: Use a real local Node 20 installation; avoid `npx node@20.x` because it can resolve dependencies from parent directories and re-trigger `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- **Added after**: Iteration 10 - `pnpm dev` failed under `npx node@20.11.1` with `file-type` export resolution errors.
