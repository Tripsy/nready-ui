import Image from 'next/image';
import type { JSX } from 'react';
import { cn } from '@/helpers/css.helper';
import { isOptimizableImageSrc } from '@/models/image.model';

const AVATAR_DEFAULT_SIZE = 32;

/**
 * The circles a nameless avatar is drawn from. Picked by name rather than at random: the same
 * person keeps their color across a page, across a re-render, and across a reload — a color that
 * changed under them would read as a different person.
 */
const AVATAR_COLORS = [
	'bg-sky-500',
	'bg-rose-500',
	'bg-violet-500',
	'bg-emerald-500',
	'bg-amber-500',
	'bg-indigo-500',
	'bg-teal-500',
	'bg-fuchsia-500',
];

/**
 * A stable index into the palette.
 *
 * Multiplying before adding is what spreads it: summing code points and taking the remainder
 * clusters names of similar length and letters onto the same color, which is how three of four
 * seeded authors ended up sharing one.
 */
function avatarColor(name: string): string {
	let hash = 0;

	for (const character of name) {
		hash = (hash * 31 + (character.codePointAt(0) ?? 0)) >>> 0;
	}

	return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * The initial a nameless avatar falls back to. Anything that is not a letter or a digit is
 * skipped — an emoji or a quote mark as the first character says nothing about who wrote it.
 */
function avatarInitial(name: string): string {
	const initial = [...name.trim()].find((character) =>
		/[\p{L}\p{N}]/u.test(character),
	);

	return initial ? initial.toUpperCase() : '?';
}

/**
 * Someone's avatar: their picture when there is one, their initial when there is not.
 *
 * A function rather than a component, in the shape `DataTableValue` and `showImage` already use
 * here — it is called from inside JSX and takes no children.
 *
 * `link` is free text wherever it comes from (an article author's avatar is a URL an editor
 * pastes), so the image is served unoptimized unless it resolves to a host this app already
 * proxies — next/image refuses a remote host that is not in `remotePatterns`.
 *
 * The circle is sized inline rather than through a Tailwind class: the size is a number a caller
 * passes, and a class name built at runtime is not in the stylesheet Tailwind generated.
 *
 * @param {string} name - Display name, used for the initial and as the image's alt text source
 * @param options
 * @param options.link - Avatar URL, when the source carries one
 * @param options.size - Diameter in pixels
 */
export function showAvatar(
	name: string,
	options?: { link?: string | null; size?: number; className?: string },
): JSX.Element {
	const size = options?.size ?? AVATAR_DEFAULT_SIZE;
	const style = { width: size, height: size };

	if (options?.link) {
		return (
			<Image
				src={options.link}
				width={size}
				height={size}
				alt=""
				unoptimized={!isOptimizableImageSrc(options.link)}
				style={style}
				className={cn(
					'shrink-0 rounded-full object-cover',
					options?.className,
				)}
			/>
		);
	}

	return (
		<span
			// Decorative: the name it stands for is always rendered next to it.
			aria-hidden="true"
			style={style}
			className={cn(
				'flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm text-white',
				avatarColor(name),
				options?.className,
			)}
		>
			{avatarInitial(name)}
		</span>
	);
}
