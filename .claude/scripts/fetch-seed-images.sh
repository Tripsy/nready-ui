#!/usr/bin/env bash
#
# Downloads the cover art for the image rows written by the API's `image` seed.
#
# The split exists because the two halves of an image live in different projects: the row is
# in the API database, the file is under this project's `IMAGE_SAVE_PATH`. The seed names
# `<section>/<id>/cover.jpg`; this fetches exactly those paths, so run it after `pnpm run seed`
# (or after `pnpm run seed image`) or the listing renders broken images.
#
# Two sources, by what the row is:
#
# - A seeded product, variant or article has a photograph of what it is. Which one is decided
#   by the API (`image.sources.ts`): the path listing carries the URL in a second,
#   tab-separated column, and this script downloads exactly that. The files are Wikimedia
#   Commons uploads, fetched politely - a named User-Agent and a pause between requests, since
#   Commons answers 429 to a burst.
# - A row the API lists no photo for falls back to picsum.photos, which serves a random photo
#   per request. The seed key is built from the section and the id, so a given row keeps its
#   photo across re-runs.
#
# A Commons photo arrives in whatever shape it was taken in, so it is center-cropped to the
# size the seed recorded - a square for a product or variant, 16:9 for an article (`sips`,
# which ships with macOS; without it the file is kept as downloaded and only the reserved space
# is off).
#
# Sizes are per section and must match the `properties` the seed recorded, since that is what
# `next/image` reserves space from: articles are 16:9, products and variants square (the
# catalog grid is `aspect-square`; the product hero crops to `aspect-video`).
#
# Usage: .claude/scripts/fetch-seed-images.sh [--force] [section ...]
#   --force  re-download files that already exist
#   section  one or more of: article, product, product_variant (default: all three)
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
UPLOAD_ROOT="$PROJECT_ROOT/public/uploads"
API_CONTAINER="nready-api.test"

# Commons rejects anonymous-looking clients and rate-limits bursts
USER_AGENT="nready-seed-images/1.0 (local development demo data)"
COMMONS_PAUSE_SECONDS=2

# Scales the file until it covers $2 x $3 pixels, then crops the middle $2 x $3 out of it.
crop_cover() {
	local file="$1" target_width="$2" target_height="$3" width height

	command -v sips >/dev/null 2>&1 || return 0

	width="$(sips -g pixelWidth "$file" | awk '/pixelWidth/ {print $2}')"
	height="$(sips -g pixelHeight "$file" | awk '/pixelHeight/ {print $2}')"

	# Cross-multiplied aspect ratios: a photo wider than the target is fitted by height and
	# loses its sides, a taller one is fitted by width and loses top and bottom.
	if [[ $((width * target_height)) -gt $((height * target_width)) ]]; then
		sips --resampleHeight "$target_height" "$file" >/dev/null
	else
		sips --resampleWidth "$target_width" "$file" >/dev/null
	fi

	# `sips -c` takes height first
	sips -c "$target_height" "$target_width" "$file" >/dev/null
}

force=0
sections=()

for arg in "$@"; do
	case "$arg" in
		--force) force=1 ;;
		*) sections+=("$arg") ;;
	esac
done

[[ ${#sections[@]} -eq 0 ]] && sections=(article product product_variant)

# Per section: the width and height the seed recorded for it.
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

	while IFS=$'\t' read -r path source_url; do
		[[ -z "$path" ]] && continue

		target="$UPLOAD_ROOT/$path"

		if [[ -f "$target" && $force -eq 0 ]]; then
			skipped=$((skipped + 1))
			continue
		fi

		mkdir -p "$(dirname "$target")"

		# The id is the directory name - used as the seed so a given row keeps its photo.
		entity_id="$(basename "$(dirname "$path")")"

		if [[ -n "${source_url:-}" ]]; then
			# A failed photo is reported and skipped rather than replaced by a random picture:
			# a missing file is visible on the page, a landscape under "Mechanical Keyboard" is not.
			if ! curl -fsSL --max-time 60 --retry 3 --retry-delay 10 -A "$USER_AGENT" \
				"$source_url" -o "$target"; then
				echo "$path: could not download $source_url" >&2
				rm -f "$target"
				continue
			fi

			crop_cover "$target" "$width" "$height"
			sleep "$COMMONS_PAUSE_SECONDS"
		else
			curl -fsSL --max-time 30 \
				"https://picsum.photos/seed/nready-${section}-${entity_id}/${width}/${height}.jpg" \
				-o "$target"
		fi

		downloaded=$((downloaded + 1))
	done <<<"$paths"

	echo "$section: $downloaded downloaded, $skipped already present"

	total_downloaded=$((total_downloaded + downloaded))
	total_skipped=$((total_skipped + skipped))
done

echo "total: $total_downloaded downloaded, $total_skipped already present ($UPLOAD_ROOT)"
