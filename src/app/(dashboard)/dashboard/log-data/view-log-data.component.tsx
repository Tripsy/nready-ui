'use client';

import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { parseJson } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { LogDataModel } from '@/models/log-data.model';

const TRANSLATION_KEYS = [
	'log-data.field.body',
	'log-data.field.category',
	'log-data.field.created_at',
	'log-data.field.file',
	'log-data.field.function',
	'log-data.field.id',
	'log-data.field.level',
	'log-data.field.line',
	'log-data.field.message',
	'log-data.field.method',
	'log-data.field.params',
	'log-data.field.pid',
	'log-data.field.query',
	'log-data.field.request_id',
	'log-data.field.trace',
	'log-data.field.url',
	'log-data.section.debug_stack',
	'log-data.section.info',
	'log-data.section.request_context',
] as const;

export function ViewLogData({ entry }: { entry: LogDataModel }) {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const parsedContext = parseJson(entry.context);
	const parsedDebugStack = parseJson(entry.debugStack);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">
					{translations['log-data.field.id']}
				</span>{' '}
				{entry.id}
			</div>

			<ViewSection title={translations['log-data.section.info']}>
				<ViewField
					label={translations['log-data.field.pid']}
					value={entry.pid}
				/>
				<ViewField
					label={translations['log-data.field.request_id']}
					value={entry.request_id}
				/>
				<ViewField
					label={translations['log-data.field.category']}
					value={entry.category}
				/>
				<ViewField
					label={translations['log-data.field.level']}
					value={entry.level}
				/>
				<ViewField
					label={translations['log-data.field.message']}
					value={entry.message}
					full
				/>
				<ViewField
					label={translations['log-data.field.created_at']}
					value={formatDate(entry.created_at, 'date-time')}
				/>
			</ViewSection>

			{parsedContext?.request && (
				<ViewSection
					title={translations['log-data.section.request_context']}
				>
					<ViewField
						label={translations['log-data.field.method']}
						value={parsedContext.request.method}
					/>
					<ViewField
						label={translations['log-data.field.url']}
						value={decodeURI(parsedContext.request.url)}
						full
					/>
					<ViewField
						label={translations['log-data.field.body']}
						value={JSON.stringify(parsedContext.request.body)}
						full
					/>
					<ViewField
						label={translations['log-data.field.params']}
						value={JSON.stringify(parsedContext.request.params)}
						full
					/>
					<ViewField
						label={translations['log-data.field.query']}
						value={JSON.stringify(parsedContext.request.query)}
						full
					/>
				</ViewSection>
			)}

			{parsedDebugStack && (
				<ViewSection
					title={translations['log-data.section.debug_stack']}
				>
					<ViewField
						label={translations['log-data.field.file']}
						value={parsedDebugStack.file}
					/>
					<ViewField
						label={translations['log-data.field.line']}
						value={parsedDebugStack.line}
					/>
					<ViewField
						label={translations['log-data.field.function']}
						value={parsedDebugStack.function}
					/>
					{parsedDebugStack.trace && (
						<ViewField
							label={translations['log-data.field.trace']}
							full
							value={
								<pre className="bg-gray-50 border rounded p-2 text-xs mt-1 overflow-x-auto">
									{parsedDebugStack.trace.join('\n')}
								</pre>
							}
						/>
					)}
				</ViewSection>
			)}
		</div>
	);
}
