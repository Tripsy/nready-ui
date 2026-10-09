---
description: Start / stop / diagnose the nready dev stack (UI + API containers and their dev servers)
argument-hint: "[start|stop|down|restart|status|logs|doctor] [api|ui|all]"
allowed-tools: Bash(../nready-api/.claude/scripts/dev-stack.sh:*), Bash(docker:*), Read, Grep, Agent
---

The stack driver lives in the sibling API repo - one script owns both sides, because starting the
UI without the API gives you a dashboard whose every request 500s. Do not copy it here; run it:

```bash
../nready-api/.claude/scripts/dev-stack.sh <command> [api|ui|all]
```

Requested action: **$ARGUMENTS** (empty means `start all`).

- `start` / `stop` / `down` / `restart` / `status` / `logs` / `doctor`
- UI - `nready-ui.test`, http://localhost, log at `logs/dev.log`
- API - `nready-api.test`, http://localhost:3000, log at `../nready-api/logs/dev.log`

Never launch the dev server with `docker exec -it … pnpm run dev` - it blocks the session and
leaves no log to diagnose from.

The full diagnosis playbook (OOM at `mem_limit: 4g`, `EADDRINUSE`, the restarted-container port
mapping that makes a healthy UI look unreachable, when to hand a dig to a subagent) is in
`../nready-api/.claude/commands/dev-stack.md`. Read it before diagnosing a failure here.

## UI container memory

This container is capped at **6g** (`mem_limit` in `docker-compose.yml`; the API's is 4g) and
Turbopack fills a large part of it - around 3.2g is its *resting* level with the dev server up,
not a leak. The Turbopack arena is capped separately at 2g (`turbopackMemoryLimit` in
`next.config.ts`); those two numbers are the lever, not the cache.

If the dev server exits with nothing in the log it was SIGKILLed, not crashed - check
`docker inspect nready-ui.test --format '{{.State.OOMKilled}}'`, then `pnpm run clean` and
restart. **`OOMKilled` can read `false` on an exit 137**: the process is killed from outside the
container (host memory pressure, Docker Desktop reclaiming) rather than by the cgroup limit, and
the symptom is the same - an API or UI that answers 404/500 to everything until it is restarted.
`/dev-stack status` reports both the exit code and that flag.
