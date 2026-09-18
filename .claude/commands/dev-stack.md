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
