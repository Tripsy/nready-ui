'use client';

import { useMemo } from 'react';
import {
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import {
	enumTranslationKeys,
	languageOwnName,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useTranslation } from '@/hooks/use-translation.hook';
import {
	type TemplateLayoutEmail,
	TemplateLayoutEmailEnum,
	type TemplateLayoutPage,
	type TemplateType,
	TemplateTypeEnum,
} from '@/models/template.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { type Language, LanguageEnum } from '@/types/common.type';

const TRANSLATION_KEYS = [
	'template.field.html',
	'template.field.label',
	'template.field.language',
	'template.field.layout',
	'template.field.subject',
	'template.field.title',
	'template.field.type',
	'template.text.placeholder_label',
	'template.text.placeholder_subject',
	'template.text.placeholder_title',
	...enumTranslationKeys('template.enum.type', TemplateTypeEnum),
	...enumTranslationKeys(
		'template.enum.layout_email',
		TemplateLayoutEmailEnum,
	),
] as const;

export type TemplateFormValuesType = {
	language: Language;
	type: TemplateType;
	label: string | null;
	content: {
		subject?: string | null; // Email specific
		title?: string | null; // Page specific
		layout: TemplateLayoutEmail | TemplateLayoutPage;
		html: string | null;
		text?: string | null;
	};
};

const languages = toOptionsFromEnum(LanguageEnum, {
	formatter: languageOwnName,
});

export function FormManageTemplate() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const emailLayouts = useMemo(
		() =>
			toOptionsFromEnum(TemplateLayoutEmailEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'template.enum.layout_email',
						value,
					),
			}),
		[translations],
	);

	const types = useMemo(
		() =>
			toOptionsFromEnum(TemplateTypeEnum, {
				formatter: (value) =>
					translateEnumLabel(
						translations,
						'template.enum.type',
						value,
					),
			}),
		[translations],
	);

	const { formValues, errors, handleChange, pending } =
		useWindowForm<TemplateFormValuesType>();

	const elementIds = useElementIds([
		'label',
		'language',
		'type',
		'content',
	] as const);

	return (
		<>
			<FormComponentInput<TemplateFormValuesType>
				id={elementIds.label}
				labelText={translations['template.field.label']}
				fieldName="label"
				fieldValue={formValues.label}
				isRequired={true}
				className="pl-8"
				placeholderText={
					translations['template.text.placeholder_label']
				}
				disabled={pending}
				onChange={(e) => handleChange('label', e.target.value)}
				error={errors.label}
				icons={{
					left: <Icons.Tag className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<div className="flex flex-wrap gap-4">
				<FormComponentSelect<TemplateFormValuesType>
					labelText={translations['template.field.language']}
					id={elementIds.language}
					fieldName="language"
					fieldValue={formValues.language}
					className="min-w-32"
					disabled={pending}
					options={languages}
					onChange={(value) =>
						handleChange('language', value as Language)
					}
					error={errors.language}
				/>
				<FormComponentSelect<TemplateFormValuesType>
					labelText={translations['template.field.type']}
					id={elementIds.type}
					fieldName="type"
					fieldValue={formValues.type}
					className="min-w-32"
					disabled={pending}
					options={types}
					onChange={(value) =>
						handleChange('type', value as TemplateType)
					}
					error={errors.type}
				/>
			</div>

			{formValues.type === TemplateTypeEnum.EMAIL && (
				<>
					<FormComponentInput<typeof formValues.content>
						id={`${elementIds.content}-subject`}
						labelText={translations['template.field.subject']}
						fieldName="subject"
						fieldValue={formValues.content.subject ?? ''}
						isRequired={true}
						placeholderText={
							translations['template.text.placeholder_subject']
						}
						disabled={pending}
						onChange={(e) =>
							handleChange('content', {
								...formValues.content,
								subject: e.target.value,
							})
						}
						error={errors.content?.subject}
					/>

					<FormComponentSelect<typeof formValues.content>
						labelText={translations['template.field.layout']}
						id={`${elementIds.content}-layout`}
						fieldName="layout"
						fieldValue={formValues.content.layout}
						className="max-w-64"
						disabled={pending}
						options={emailLayouts}
						onChange={(value) =>
							handleChange('content', {
								...formValues.content,
								layout: value as TemplateLayoutEmail,
							})
						}
						error={errors.content?.layout}
					/>

					<FormComponentTextarea<typeof formValues.content>
						id={`${elementIds.content}-html`}
						labelText={translations['template.field.html']}
						fieldName="html"
						fieldValue={formValues.content.html}
						isRequired={true}
						disabled={pending}
						onChange={(e) =>
							handleChange('content', {
								...formValues.content,
								html: e.target.value,
							})
						}
						error={errors.content?.html}
						rows={6}
					/>
				</>
			)}

			{formValues.type === TemplateTypeEnum.PAGE && (
				<>
					<FormComponentInput<typeof formValues.content>
						id={`${elementIds.content}-title`}
						labelText={translations['template.field.title']}
						fieldName="title"
						fieldValue={formValues.content.title ?? ''}
						isRequired={true}
						placeholderText={
							translations['template.text.placeholder_title']
						}
						disabled={pending}
						onChange={(e) =>
							handleChange('content', {
								...formValues.content,
								title: e.target.value,
							})
						}
						error={errors.content?.title}
					/>

					<FormComponentSelect<typeof formValues.content>
						labelText={translations['template.field.layout']}
						id={`${elementIds.content}-layout`}
						fieldName="layout"
						fieldValue={formValues.content.layout}
						className="max-w-64"
						disabled={pending}
						options={emailLayouts}
						onChange={(value) =>
							handleChange('content', {
								...formValues.content,
								layout: value as TemplateLayoutPage,
							})
						}
						error={errors.content?.layout}
					/>

					<FormComponentTextarea<typeof formValues.content>
						id={`${elementIds.content}-html`}
						labelText={translations['template.field.html']}
						fieldName="html"
						fieldValue={formValues.content.html}
						isRequired={true}
						disabled={pending}
						onChange={(e) =>
							handleChange('content', {
								...formValues.content,
								html: e.target.value,
							})
						}
						error={errors.content?.html}
						rows={11}
					/>
				</>
			)}
		</>
	);
}
