'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import {
	enumTranslationKeys,
	translateEnumLabel,
} from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { type TermModel, TermTypeEnum } from '@/models/term.model';
import { LanguageEnum } from '@/types/common.type';

const TRANSLATION_KEYS = [
	'term.field.created_at',
	'term.field.deleted_at',
	'term.field.id',
	'term.field.updated_at',
	'term.section.timestamps',
	'term.section.wording',
	'term.text.not_translated',
	...enumTranslationKeys('term.enum.type', TermTypeEnum),
] as const;

export function ViewTerm({ entry }: { entry: TermModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const contents = entry.contents ?? [];

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['term.field.id']}
				</span>{' '}
				{entry.id}
				<span className="ml-2">
					{translateEnumLabel(
						translations,
						'term.enum.type',
						entry.type,
					)}
				</span>
			</div>

			<ViewSection title={translations['term.section.wording']}>
				{Object.values(LanguageEnum).map((language) => {
					const content = contents.find(
						(entry) => entry.language === language,
					);

					return (
						<ViewField
							key={language}
							label={language.toUpperCase()}
							value={
								content?.value ?? (
									// A term needs no translation in every language; saying so
									// beats an empty cell that reads like a loading failure
									<span className="opacity-60">
										{
											translations[
												'term.text.not_translated'
											]
										}
									</span>
								)
							}
						/>
					);
				})}
			</ViewSection>

			<ViewSection title={translations['term.section.timestamps']}>
				<ViewField
					label={translations['term.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label={translations['term.field.updated_at']}
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label={translations['term.field.deleted_at']}
						value={
							<span className="text-danger">
								{formatDate(entry.deleted_at, 'date-time')}
							</span>
						}
					/>
				)}
			</ViewSection>
		</div>
	);
}
