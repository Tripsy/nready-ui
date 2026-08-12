import {
	FormComponentInput,
	FormComponentSelect,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { Icons } from '@/components/icon.component';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import {
	type TemplateLayoutEmail,
	TemplateLayoutEmailEnum,
	type TemplateLayoutPage,
	type TemplateType,
	TemplateTypeEnum,
} from '@/models/template.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { type Language, LanguageEnum } from '@/types/common.type';

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
	formatter: formatEnumLabel,
});

const types = toOptionsFromEnum(TemplateTypeEnum, {
	formatter: formatEnumLabel,
});

const emailLayouts = toOptionsFromEnum(TemplateLayoutEmailEnum, {
	formatter: formatEnumLabel,
});

export function FormManageTemplate() {
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
				labelText="Label"
				fieldName="label"
				fieldValue={formValues.label}
				isRequired={true}
				className="pl-8"
				placeholderText="eg: password-recover"
				disabled={pending}
				onChange={(e) => handleChange('label', e.target.value)}
				error={errors.label}
				icons={{
					left: <Icons.Tag className="opacity-40 h-4.5 w-4.5" />,
				}}
			/>

			<div className="flex flex-wrap gap-4">
				<FormComponentSelect<TemplateFormValuesType>
					labelText="Language"
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
					labelText="Type"
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
						labelText="Subject"
						fieldName="subject"
						fieldValue={formValues.content.subject ?? ''}
						isRequired={true}
						placeholderText="eg: Recover password"
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
						labelText="layout"
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
						labelText="HTML Content"
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
						labelText="Title"
						fieldName="title"
						fieldValue={formValues.content.title ?? ''}
						isRequired={true}
						placeholderText="eg: Terms & Conditions"
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
						labelText="Layout"
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
						labelText="HTML Content"
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
