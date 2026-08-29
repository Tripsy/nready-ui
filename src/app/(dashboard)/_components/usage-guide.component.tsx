'use client';

import { useState } from 'react';
import { ApiDocs } from '@/app/(dashboard)/_components/api-docs.component';
import { Icons } from '@/components/icon.component';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation.hook';

/**
 * One API-docs tab. `feature` is the backend route module `GET /docs/:feature` serves, which
 * is not always the entity: a feature directory can hold more than one module, and the article
 * folder ships `article` alongside `article-public`.
 */
export type UsageGuideDocsTab = {
	id: string;
	/** Key under `<entity>.help`, e.g. `tab_api`. */
	labelKey: string;
	feature: string;
};

const TAB_INFO = 'info';

/**
 * The window behind every entity's "Usage guide" action: a written checklist, then one tab per
 * documented route module.
 *
 * Entity-specific only through `entity`, which is both the locale namespace (`<entity>.help.*`)
 * and the step numbering, so a new entity is a locale block plus a one-line wrapper rather than
 * another copy of this file.
 */
export function UsageGuide({
	entity,
	stepCount,
	docsTabs,
}: {
	entity: string;
	stepCount: number;
	docsTabs: UsageGuideDocsTab[];
}) {
	const steps = Array.from({ length: stepCount }, (_, index) =>
		String(index + 1),
	);

	/*
	 * Built per render rather than declared as a literal: `useTranslation` keys its effects on
	 * the joined contents, not the array's identity, so a fresh array of the same keys costs
	 * nothing.
	 */
	const translationKeys = [
		`${entity}.help.intro`,
		`${entity}.help.note`,
		`${entity}.help.tab_info`,
		...docsTabs.map((tab) => `${entity}.help.${tab.labelKey}`),
		...steps.flatMap((step) => [
			`${entity}.help.step_${step}_title`,
			`${entity}.help.step_${step}_body`,
		]),
	];

	const { translations, isTranslationLoading } =
		useTranslation(translationKeys);

	/*
	 * Tracked rather than left to the tabs, because every panel stays mounted (`TabsContent`
	 * force-mounts) — each docs request is deferred until its own tab has been opened instead
	 * of firing for everyone who opens the window.
	 */
	const [selectedTab, setSelectedTab] = useState<string>(TAB_INFO);

	if (isTranslationLoading) {
		return null;
	}

	return (
		<Tabs
			defaultSelectedKey={TAB_INFO}
			onSelectionChange={(key) => setSelectedTab(String(key))}
			className="w-full"
		>
			<div className="border-b border-line pb-2">
				<TabsList>
					<TabsTrigger id={TAB_INFO}>
						{translations[`${entity}.help.tab_info`]}
					</TabsTrigger>
					{docsTabs.map((tab) => (
						<TabsTrigger key={tab.id} id={tab.id}>
							{translations[`${entity}.help.${tab.labelKey}`]}
						</TabsTrigger>
					))}
				</TabsList>
			</div>

			<TabsContent id={TAB_INFO} className="pt-4">
				<div className="space-y-6">
					<p className="text-muted">
						{translations[`${entity}.help.intro`]}
					</p>

					<ol className="space-y-4">
						{steps.map((step) => (
							<li key={step} className="flex gap-3">
								<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-medium">
									{step}
								</span>
								<div>
									<p className="font-medium">
										{
											translations[
												`${entity}.help.step_${step}_title`
											]
										}
									</p>
									<p className="text-sm text-muted">
										{
											translations[
												`${entity}.help.step_${step}_body`
											]
										}
									</p>
								</div>
							</li>
						))}
					</ol>

					<div className="flex items-start gap-2 rounded-lg bg-sidebar-accent p-4">
						<Icons.Info className="h-4 w-4 shrink-0 mt-0.5 text-sidebar-accent-foreground" />
						<p className="text-sm text-sidebar-accent-foreground">
							{translations[`${entity}.help.note`]}
						</p>
					</div>
				</div>
			</TabsContent>

			{docsTabs.map((tab) => (
				<TabsContent key={tab.id} id={tab.id} className="pt-4">
					<ApiDocs
						feature={tab.feature}
						enabled={selectedTab === tab.id}
					/>
				</TabsContent>
			))}
		</Tabs>
	);
}
