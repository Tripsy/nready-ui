export type AuthTokenType = {
	ident: string;
	label: string;
	used_at: Date;
	used_now: boolean; // true - if is a match for the current session
};
