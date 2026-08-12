import type { Language } from '@/types/common.type';

export const TemplateTypeEnum = {
	PAGE: 'page',
	EMAIL: 'email',
} as const;

export type TemplateType =
	(typeof TemplateTypeEnum)[keyof typeof TemplateTypeEnum];

export const TemplateLayoutEmailEnum = {
	DEFAULT: 'default',
} as const;

export type TemplateLayoutEmail =
	(typeof TemplateLayoutEmailEnum)[keyof typeof TemplateLayoutEmailEnum];

export const TemplateLayoutPageEnum = {
	DEFAULT: 'default',
} as const;

export type TemplateLayoutPage =
	(typeof TemplateLayoutPageEnum)[keyof typeof TemplateLayoutPageEnum];

export type TemplateContentEmailType = {
	subject: string;
	layout: TemplateLayoutEmail;
	html: string;
	text?: string;
	vars: Record<string, unknown>;
};

export type TemplateContentPageType = {
	title: string;
	html: string;
	layout: TemplateLayoutPage;
};

export type TemplateModel<D = Date | string> = {
	id: number;
	label: string;
	language: Language;
	type: TemplateType;
	content: string;
	created_at: D;
	updated_at: D;
	deleted_at: D;
};
