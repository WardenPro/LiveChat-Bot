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

