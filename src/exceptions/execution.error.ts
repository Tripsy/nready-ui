export class ExecutionError extends Error {
	constructor(message: string) {
		super(message);

		// Maintain a proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ExecutionError);
		}
	}
}
