---
description: List and summarize open Sentry issues for this project
---

Use the `sentry` MCP tools to list unresolved issues for this project's Sentry org/project
(check `NEXT_PUBLIC_SENTRY_DSN` in `.env` if the project isn't obvious). For each issue report:
title, level (error/warning), event count, users affected, first/last seen, and a short guess at
the likely source file from the stack trace. Sort by event count descending. Do not attempt to
resolve or comment on issues unless asked.
