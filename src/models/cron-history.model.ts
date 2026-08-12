export const CronHistoryStatusEnum = {
	ERROR: 'error',
	OK: 'ok',
	WARNING: 'warning',
} as const;

export type CronHistoryStatus =
	(typeof CronHistoryStatusEnum)[keyof typeof CronHistoryStatusEnum];

export type CronHistoryModel<D = Date | string> = {
	id: number;
	label: string;
	status: CronHistoryStatus;
	start_at: D;
	end_at: D;
	run_time: number;
	content?: string;
};
