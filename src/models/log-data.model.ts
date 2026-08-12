export const LogLevelEnum = {
	TRACE: 'trace', // 10
	DEBUG: 'debug', // 20
	INFO: 'info', // 30
	WARN: 'warn', // 40
	ERROR: 'error', // 50
	FATAL: 'fatal', // 60
} as const;

export type LogLevel = (typeof LogLevelEnum)[keyof typeof LogLevelEnum];

export const LogCategoryEnum = {
	SYSTEM: 'system',
	HISTORY: 'history',
	CRON: 'cron',
	INFO: 'info',
	ERROR: 'error',
} as const;

export type LogCategory =
	(typeof LogCategoryEnum)[keyof typeof LogCategoryEnum];

export type LogDataModel<D = Date | string> = {
	id: number;
	pid: string;
	request_id: string | null;
	category: LogCategory;
	level: LogLevel;
	message: string;
	context: string;
	debugStack: string;
	created_at: D;
};
