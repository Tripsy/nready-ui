'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/helpers/date.helper';
import {
	capitalizeFirstLetter,
	formatEnumLabel,
} from '@/helpers/string.helper';
import type { PlaceModel } from '@/models/place.model';

export function ViewPlace({ entry }: { entry: PlaceModel }) {
	const languageContents = Object.values(entry.contents ?? []);
	const contentTabDefault = languageContents[0]?.language;

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Type"
					value={formatEnumLabel(entry.place_type)}
				/>
				<ViewField label="Code" value={entry.code} />
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

			{languageContents.length > 0 && (
				<div>
					<Tabs
						defaultSelectedKey={contentTabDefault}
						className="w-full"
					>
						<div className="flex items-center border-b border-line pb-2 gap-2">
							<h3 className="font-bold whitespace-nowrap">
								Language specific
							</h3>
							<TabsList>
								{languageContents.map((value) => (
									<TabsTrigger
										key={value.language}
										id={value.language}
									>
										{value.language.toUpperCase()}
									</TabsTrigger>
								))}
							</TabsList>
						</div>
						{languageContents.map((value) => (
							<TabsContent
								key={`content-${value.language}`}
								id={value.language}
							>
								<div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
									<ViewField
										label="Type - Label"
										value={capitalizeFirstLetter(
											value.type_label,
										)}
									/>
									<ViewField
										label="Name"
										value={value.name}
									/>
								</div>
							</TabsContent>
						))}
					</Tabs>
				</div>
			)}
		</div>
	);
}
