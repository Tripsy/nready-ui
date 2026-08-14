'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import type { TermModel } from '@/models/term.model';
import { LanguageEnum } from '@/types/common.type';

export function ViewTerm({ entry }: { entry: TermModel }) {
	const contents = entry.contents ?? [];

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<span className="ml-2">{formatEnumLabel(entry.type)}</span>
			</div>

			<ViewSection title="Wording">
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
										not translated
									</span>
								)
							}
						/>
					);
				})}
			</ViewSection>

			<ViewSection title="Timestamps">
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
				<ViewField
					label="Updated At"
					value={formatDate(entry.updated_at, 'date-time')}
				/>
				{entry.deleted_at && (
					<ViewField
						label="Deleted At"
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
