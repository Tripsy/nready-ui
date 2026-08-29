'use client';

import { useState } from 'react';
import { ApiDocs } from '@/components/api-docs.component';
import { Icons } from '@/components/icon.component';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from '@/hooks/use-translation.hook';

const STEP_KEYS = ['1', '2', '3', '4', '5'] as const;

const TRANSLATION_KEYS = [
	'user.help.intro',
	'user.help.note',
	'user.help.tab_info',
	'user.help.tab_api',
	...STEP_KEYS.flatMap(
		(step) =>
			[
				`user.help.step_${step}_title`,
				`user.help.step_${step}_body`,
			] as const,
	),
] as const;

const TAB_INFO = 'info';
const TAB_API = 'api';

function UsageGuideSteps({
	translations,
}: {
	translations: Record<string, string>;
}) {
	return (
		<div className="space-y-6">
			<p className="text-muted">{translations['user.help.intro']}</p>

			<ol className="space-y-4">
				{STEP_KEYS.map((step) => (
					<li key={step} className="flex gap-3">
						<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground text-sm font-medium">
							{step}
						</span>
						<div>
							<p className="font-medium">
								{translations[`user.help.step_${step}_title`]}
							</p>
							<p className="text-sm text-muted">
								{translations[`user.help.step_${step}_body`]}
							</p>
						</div>
					</li>
				))}
			</ol>

			<div className="flex items-start gap-2 rounded-lg bg-sidebar-accent p-4">
				<Icons.Info className="h-4 w-4 shrink-0 mt-0.5 text-sidebar-accent-foreground" />
				<p className="text-sm text-sidebar-accent-foreground">
					{translations['user.help.note']}
				</p>
			</div>
		</div>
	);
}

// `uid`/`entries` are unused — this is a `free`-selection, entry-less `other` window.
export function UsageGuideUser(_props: { uid: string; entries: unknown[] }) {
	const { translations, isTranslationLoading } =
		useTranslation(TRANSLATION_KEYS);

	/*
	 * Tracked rather than left to the tabs, because both panels stay mounted (`TabsContent`
	 * force-mounts) — the API docs request is deferred until its tab has actually been opened
	 * instead of firing for everyone who opens the window.
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
						{translations['user.help.tab_info']}
					</TabsTrigger>
					<TabsTrigger id={TAB_API}>
						{translations['user.help.tab_api']}
					</TabsTrigger>
				</TabsList>
			</div>

			<TabsContent id={TAB_INFO} className="pt-4">
				<UsageGuideSteps translations={translations} />
			</TabsContent>

			<TabsContent id={TAB_API} className="pt-4">
				<ApiDocs feature="user" enabled={selectedTab === TAB_API} />
			</TabsContent>
		</Tabs>
	);
}
