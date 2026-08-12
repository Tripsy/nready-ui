'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDate } from '@/helpers/date.helper';
import { DisplayStatus, displayImage } from '@/helpers/display.helper';
import { formatEnumLabel } from '@/helpers/string.helper';
import { type ImageModel, showImage } from '@/models/image.model';

export function ViewImage({ entry }: { entry: ImageModel }) {
	const languageContents = Object.values(entry.contents ?? []);
	const contentTabDefault = languageContents[0]?.language;

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
				<div className="max-w-60 ml-2">
					<DisplayStatus status={entry.status} dataSource="image" />
				</div>
			</div>

			<ViewSection title="Info">
				<ViewField
					label="Section"
					value={formatEnumLabel(entry.section)}
				/>
				<ViewField
					label="Type"
					value={formatEnumLabel(entry.image_type)}
				/>
				<ViewField
					label="Image"
					value={displayImage({
						src: showImage(entry.path, entry.storage),
						alt: entry.path,
						width: 100,
						height: 100,
					})}
				/>
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
						{languageContents.map((value) => {
							return (
								<TabsContent
									key={`content-${value.language}`}
									id={value.language}
								>
									<div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
										<ViewField
											label="Title"
											value={value.title}
										/>
										<ViewField
											label="Description"
											value={value.description}
										/>
									</div>
								</TabsContent>
							);
						})}
					</Tabs>
				</div>
			)}
		</div>
	);
}
