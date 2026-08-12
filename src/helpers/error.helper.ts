/**
 * Reads a message off an unknown thrown value.
 *
 * A `catch` binding is `unknown` — anything can be thrown, and a non-`Error` reaching
 * `error.message` yields `undefined` rather than failing loudly. Use this wherever the caught
 * value's type isn't guaranteed.
 *
 * Deliberately free of imports so it stays usable from client components.
 */
export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
