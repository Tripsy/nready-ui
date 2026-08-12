import {
	ViewField,
	ViewSection,
} from '@/app/(dashboard)/_components/view-detail';
import { formatDate } from '@/helpers/date.helper';
import { parseJson } from '@/helpers/string.helper';
import type { LogDataModel } from '@/models/log-data.model';

export function ViewLogData({ entry }: { entry: LogDataModel }) {
	const parsedContext = parseJson(entry.context);
	const parsedDebugStack = parseJson(entry.debugStack);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 border-b border-line pb-4">
				<span className="font-semibold">ID</span> {entry.id}
			</div>

			<ViewSection title="Info">
				<ViewField label="PID" value={entry.pid} />
				<ViewField label="Request ID" value={entry.request_id} />
				<ViewField label="Category" value={entry.category} />
				<ViewField label="Level" value={entry.level} />
				<ViewField label="Message" value={entry.message} full />
				<ViewField
					label="Created At"
					value={formatDate(entry.created_at, 'date-time')}
				/>
			</ViewSection>

			{parsedContext?.request && (
				<ViewSection title="Request Context">
					<ViewField
						label="Method"
						value={parsedContext.request.method}
					/>
					<ViewField
						label="URL"
						value={decodeURI(parsedContext.request.url)}
						full
					/>
					<ViewField
						label="Body"
						value={JSON.stringify(parsedContext.request.body)}
						full
					/>
					<ViewField
						label="Params"
						value={JSON.stringify(parsedContext.request.params)}
						full
					/>
					<ViewField
						label="Query"
						value={JSON.stringify(parsedContext.request.query)}
						full
					/>
				</ViewSection>
			)}

			{parsedDebugStack && (
				<ViewSection title="Debug Stack">
					<ViewField label="File" value={parsedDebugStack.file} />
					<ViewField label="Line" value={parsedDebugStack.line} />
					<ViewField
						label="Function"
						value={parsedDebugStack.function}
					/>
					{parsedDebugStack.trace && (
						<ViewField
							label="Trace"
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
