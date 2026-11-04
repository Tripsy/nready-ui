#!/bin/sh
# Targeted tsc on the given files (repo-relative), via tsconfig.probe.json at the project root.
# `@file` reads one path per line. Env: I18N_ROOT (host path, default cwd), I18N_CONTAINER
# (docker container running the project), I18N_CONTAINER_ROOT (default /var/www/html).
ROOT=${I18N_ROOT:-$(pwd)}; CROOT=${I18N_CONTAINER_ROOT:-/var/www/html}
cd "$ROOT" || exit 1
node -e '
const args = process.argv.slice(1).flatMap(a => a.startsWith("@") ? require("fs").readFileSync(a.slice(1), "utf8").split("\n").filter(Boolean) : [a]);
const root = process.cwd() + "/";
const files = ["next-env.d.ts", ...args.map(f => f.replace(root, ""))];
require("fs").writeFileSync("tsconfig.probe.json", JSON.stringify({ extends: "./tsconfig.json", compilerOptions: { incremental: false, plugins: [] }, include: [], files }, null, "\t") + "\n");
' "$@"
out=$(docker exec "$I18N_CONTAINER" npx tsc -p "$CROOT/tsconfig.probe.json" 2>&1); code=$?
printf "%s\n" "$out" | grep -v "npm notice" | grep -v "^$"
echo "tsc exit=$code"
exit $code
