#!/bin/sh
# Mechanical pass for one entity: backup (once), converter, enum converter, scan.
# usage: run.sh <entity> [namespace]   - from the project root (or set I18N_ROOT)
S=$(cd "$(dirname "$0")" && pwd); E=$1; NS=${2:-$1}
ROOT=${I18N_ROOT:-$(pwd)}; WORK=${I18N_WORK:-$ROOT/.i18n-work}
DASH=${I18N_DASH:-$ROOT/src/app/(dashboard)/dashboard}
D="$DASH/$E"
mkdir -p "$WORK/backup"
[ -d "$WORK/backup/$E" ] || cp -R "$D" "$WORK/backup/$E"
cd "$ROOT" || exit 1
node "$S/convert.cjs" "$NS" "$D" | grep -v '^converted'
node "$S/enumify.cjs" "$NS" "$D"
echo "--- scan"
node "$S/scan-copy.cjs" "$D"
