#!/usr/bin/env bash
#
# Downloads the cover art for the image rows written by the API's `image` seed.
#
# The split exists because the two halves of an image live in different projects: the row is
# in the API database, the file is under this project's `IMAGE_SAVE_PATH`. The seed names
# `<section>/<id>/cover.jpg`; this fetches exactly those paths, so run it after `pnpm run seed`
# (or after `pnpm run seed image`) or the listing renders broken images.
#
# Source is picsum.photos, which serves a random photo per request. The seed key is built from
# the section and the id, so a given row keeps its photo across re-runs of this script - and a
# product and the variant that happens to share its id get different pictures, which is the
# whole point of the per-variant gallery.
#
# Sizes are per section and must match the `properties` the seed recorded, since that is what
# `next/image` reserves space from: articles are 16:9, products and variants square (the
# catalog grid is `aspect-square`; the product hero crops to `aspect-video`).
#
# Usage: .claude/scripts/fetch-seed-images.sh [--force] [section ...]
#   --force  re-download files that already exist
#   section  one or more of: article, product, product_variant (default: all three)
set -euo pipefail

UPLOAD_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/public/uploads"
API_CONTAINER="nready-api.test"

force=0
sections=()

for arg in "$@"; do
	case "$arg" in
		--force) force=1 ;;
		*) sections+=("$arg") ;;
	esac
done

[[ ${#sections[@]} -eq 0 ]] && sections=(article product product_variant)

# Per section: the picsum dimensions the seed recorded for it.
dimensions_for() {
	case "$1" in
		article) echo "1200 675" ;;
		product | product_variant) echo "1000 1000" ;;
		*) echo "Unknown section \"$1\"" >&2; return 1 ;;
	esac
}

total_downloaded=0
total_skipped=0

for section in "${sections[@]}"; do
	read -r width height <<<"$(dimensions_for "$section")"

	# The seed is the authority on which rows have a cover, so the paths are read back out of
	# the API database rather than recomputed here from the same modulo.
	paths=$(docker exec "$API_CONTAINER" sh -c \
		"cd /var/www/html && npx tsx cli/list-image-paths.ts $section" 2>/dev/null | grep "^$section/") || {
		echo "Could not read $section image rows from $API_CONTAINER - is the stack up and seeded?" >&2
		exit 1
	}

	if [[ -z "$paths" ]]; then
		echo "$section: no image rows found - run the API's image seed first." >&2
		continue
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

		# The id is the directory name - used as the seed so a given row keeps its photo.
		entity_id="$(basename "$(dirname "$path")")"

		curl -fsSL --max-time 30 \
			"https://picsum.photos/seed/nready-${section}-${entity_id}/${width}/${height}.jpg" \
			-o "$target"

		downloaded=$((downloaded + 1))
	done <<<"$paths"

	echo "$section: $downloaded downloaded, $skipped already present"

	total_downloaded=$((total_downloaded + downloaded))
	total_skipped=$((total_skipped + skipped))
done

echo "total: $total_downloaded downloaded, $total_skipped already present ($UPLOAD_ROOT)"
