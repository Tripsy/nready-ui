export const CurrencyEnum = {
	RON: 'RON',
	EUR: 'EUR',
	USD: 'USD',
} as const;

export type Currency = (typeof CurrencyEnum)[keyof typeof CurrencyEnum];

export const LanguageEnum = {
	EN: 'en',
	RO: 'ro',
} as const;

export type Language = (typeof LanguageEnum)[keyof typeof LanguageEnum];

export type StatusTransitions<S extends string> = Record<S, S[]>;
