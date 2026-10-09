export const CronHistoryStatusEnum = {
	ERROR: 'error',
	OK: 'ok',
	WARNING: 'warning',
	RUNNING: 'running',
} as const;

export type CronHistoryStatus =
	(typeof CronHistoryStatusEnum)[keyof typeof CronHistoryStatusEnum];

export type CronHistoryModel<D = Date | string> = {
	id: number;
	label: string;
	status: CronHistoryStatus;
	start_at: D;
	// NULL while the run is in progress
	end_at: D | null;
	run_time: number;
	content?: string;
};
