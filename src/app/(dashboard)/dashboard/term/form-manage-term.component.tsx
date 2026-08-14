import { useState } from 'react';
import {
	FormComponentInput,
	FormComponentSelect,
} from '@/components/form/form-element.component';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Configuration } from '@/config/settings.config';
import { toOptionsFromEnum } from '@/helpers/form.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import {
	type TermContentType,
	type TermType,
	TermTypeEnum,
} from '@/models/term.model';
import { useWindowForm } from '@/providers/window-form.provider';
import { type Language, LanguageEnum } from '@/types/common.type';

export type TermFormValuesType = {
	type: TermType;

	contents: TermContentType[];
};

const languages = Object.values(LanguageEnum);

const types = toOptionsFromEnum(TermTypeEnum, {
	formatter: formatEnumLabel,
});

export function FormManageTerm() {
	const { formValues, errors, handleChange, pending } =
		useWindowForm<TermFormValuesType>();

	const elementIds = useElementIds(['type', 'contents'] as const);

	const [contentsMap, setContentsMap] = useState<
		Partial<Record<Language, TermContentType>>
	>(
		() =>
			Object.fromEntries(
				(formValues.contents ?? []).map((content) => [
					content.language,
					content,
				]),
			) as Partial<Record<Language, TermContentType>>,
	);

	const handleContentChange = (language: Language, value: string) => {
		const updated = {
			...contentsMap,
			[language]: { language, value },
		};

		setContentsMap(updated);

		/*
		 * A language the user never filled in must not reach the backend: `value` is required
		 * on every content, so an empty tab would fail validation for a translation nobody
		 * asked for. Dropping it here also leaves any existing row for that language untouched,
		 * since `saveContent` upserts rather than replacing the set.
		 */
		handleChange(
			'contents',
			Object.values(updated).filter(
				(content): content is TermContentType =>
					!!content?.value?.trim(),
			),
		);
	};

	return (
		<>
			<FormComponentSelect<TermFormValuesType>
				labelText="Type"
				id={elementIds.type}
				fieldName="type"
				fieldValue={formValues.type}
				className="min-w-40"
				disabled={pending}
				options={types}
				onChange={(value) => handleChange('type', value as TermType)}
				error={errors.type}
			/>

			<input
				type="hidden"
				name="contents"
				value={JSON.stringify(formValues.contents ?? [])}
			/>

			<Tabs
				defaultSelectedKey={Configuration.defaultLanguage()}
				className="w-full"
			>
				<div className="flex items-center border-b border-line pb-2 gap-2">
					<h3 className="font-bold whitespace-nowrap">
						Language specific
					</h3>
					<TabsList>
						{languages.map((language) => (
							<TabsTrigger key={language} id={language}>
								{language.toUpperCase()}
							</TabsTrigger>
						))}
					</TabsList>
				</div>

				{languages.map((language) => {
					const contentIndex = (formValues.contents ?? []).findIndex(
						(content) => content.language === language,
					);

					return (
						<TabsContent key={`form-${language}`} id={language}>
							<div className="form-section">
								<FormComponentInput<TermContentType>
									id={`${elementIds.contents}-${language}-value`}
									labelText="Value"
									fieldName="value"
									fieldValue={
										contentsMap[language]?.value ?? ''
									}
									isRequired={
										language ===
										Configuration.defaultLanguage()
									}
									placeholderText="e.g.: Waterproof"
									disabled={pending}
									onChange={(e) =>
										handleContentChange(
											language,
											e.target.value,
										)
									}
									error={
										contentIndex >= 0
											? errors.contents?.[contentIndex]
													?.value
											: undefined
									}
								/>
							</div>
						</TabsContent>
					);
				})}
			</Tabs>
		</>
	);
}
