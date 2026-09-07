#!/usr/bin/env bash
#
# Downloads cover art for the article rows written by the API's `image` seed.
#
# The split exists because the two halves of an image live in different projects: the row is
# in the API database, the file is under this project's `IMAGE_SAVE_PATH`. The seed names
# `article/<id>/cover.jpg`; this fetches exactly those paths, so run it after `pnpm run seed`
# (or after `pnpm run seed image`) or the listing renders broken images.
#
# Source is picsum.photos, which serves a random photo per request. `?random=<id>` keeps a
# given article's cover stable across re-runs of this script.
#
# Usage: .claude/scripts/fetch-seed-images.sh [--force]
#   --force  re-download files that already exist
set -euo pipefail

UPLOAD_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/public/uploads"
API_CONTAINER="nready-api.test"
WIDTH=1200
HEIGHT=675

force=0
[[ "${1:-}" == "--force" ]] && force=1

# The seed is the authority on which articles have a cover, so the paths are read back out of
# the API database rather than recomputed here from the same modulo.
paths=$(docker exec "$API_CONTAINER" sh -c \
	"cd /var/www/html && npx tsx cli/list-image-paths.ts article" 2>/dev/null | grep '^article/') || {
	echo "Could not read image rows from $API_CONTAINER - is the stack up and seeded?" >&2
	exit 1
}

if [[ -z "$paths" ]]; then
	echo "No article image rows found. Run the API's image seed first." >&2
	exit 1
fi

downloaded=0
skipped=0

while IFS= read -r path; do
	[[ -z "$path" ]] && continue

	target="$UPLOAD_ROOT/$path"

	if [[ -f "$target" && $force -eq 0 ]]; then
		skipped=$((skipped + 1))
		continue
	fi

	mkdir -p "$(dirname "$target")"

	# The id is the directory name - used as the seed so a given article keeps its photo.
	article_id="$(basename "$(dirname "$path")")"

	curl -fsSL --max-time 30 \
		"https://picsum.photos/seed/nready-article-${article_id}/${WIDTH}/${HEIGHT}.jpg" \
		-o "$target"

	downloaded=$((downloaded + 1))
done <<<"$paths"

echo "article covers: $downloaded downloaded, $skipped already present ($UPLOAD_ROOT)"
