import type { TemplateContentEmailType } from '@/models/template.model';
import type { Language } from '@/types/common.type';

export const MailQueueStatusEnum = {
	PENDING: 'pending',
	SENT: 'sent',
	ERROR: 'error',
} as const;

export type MailQueueStatus =
	(typeof MailQueueStatusEnum)[keyof typeof MailQueueStatusEnum];

export type MailQueueModel<D = Date | string> = {
	id: number;
	template: {
		id: number;
		label: string;
	} | null;
	language: Language;
	content: TemplateContentEmailType;
	to: {
		name: string;
		address: string;
	};
	from?: {
		name: string;
		address: string;
	};
	status: MailQueueStatus;
	error: string | null;
	sent_at: D;
	created_at: D;
	updated_at: D;
};
