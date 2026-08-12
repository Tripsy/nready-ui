import type { ApiResponseFetch } from '@/types/api.type';

export class ApiError<T = unknown> extends Error {
	constructor(
		message: string,
		public status: number,
		public body?: ApiResponseFetch<T>,
	) {
		super(body?.message || message);

		this.name = 'ApiError';
		this.status = status;
		this.body = body;

		// Maintain a proper stack trace
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ApiError);
		}
	}
}
