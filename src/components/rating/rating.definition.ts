/**
 * The reaction picker's copy. Kept in the `rating` namespace and out of the client component, so
 * a server component can spread the keys — a `'use client'` module's value exports are client
 * references by the time one reads them.
 */
export const RATING_TRANSLATION_PREFIX = 'rating';

export const RATING_TRANSLATION_KEYS = [
	'reaction.action',
	'reaction.failed',
	'reaction.like',
	'reaction.dislike',
	'reaction.love',
	'reaction.insightful',
	'reaction.funny',
] as const;

export type RatingTranslations = Record<
	(typeof RATING_TRANSLATION_KEYS)[number],
	string
>;
