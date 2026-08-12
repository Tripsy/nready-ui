'use client';

import { Download } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
	FormComponentAutoComplete,
	FormComponentSelect,
	type OptionsType,
} from '@/components/form/form-element.component';
import { Button } from '@/components/ui/button';
import Routes from '@/config/routes.setup';
import { buildQueryString } from '@/helpers/api.helper';
import { requestFind } from '@/helpers/services.helper';
import { useElementIds } from '@/hooks/use-element-ids.hook';
import { useRemoteAutocomplete } from '@/hooks/use-remote-autocomplete';
import {
	displayUserLabel,
	type UserModel,
	UserRoleEnum,
} from '@/models/user.model';
import type { FindFunctionResponseType } from '@/types/action.type';

// Field-name typing only — this component keeps its own state, it never submits
// as a native form, so the shape just needs to name the two controls.
type ReportFormFields = { user: string; period: string };

// Current month plus the six preceding it — the window the export is allowed to cover.
// Value is `YYYY-MM`; the backend splits it back into year/month.
function getPeriodOptions(): OptionsType {
	const now = new Date();

	return Array.from({ length: 7 }, (_, i) => {
		const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const month = String(date.getMonth() + 1).padStart(2, '0');

		return {
			label: date.toLocaleString('en-US', {
				month: 'long',
				year: 'numeric',
			}),
			value: `${date.getFullYear()}-${month}`,
		};
	});
}

/**
 * The export is a binary file download (not JSON), so it's built as a URL to
 * navigate to rather than an `ApiRequest.doFetch` call — the proxy streams the
 * backend's xlsx response straight through, and the browser's own
 * `Content-Disposition` handling triggers the download.
 */
function buildExportReportUrl(userId: number, period: string): string {
	const path = Routes.get('proxy', {
		path: ['stats', 'report-driver-monthly'],
	});
	const query = buildQueryString({ user_id: userId, period });

	return `${path}?${query}`;
}

export function DriverMonthlyReport() {
	const periodOptions = useMemo(() => getPeriodOptions(), []);

	const [period, setPeriod] = useState(periodOptions[0].value);
	const [searchUser, setSearchUser] = useState('');
	const [userId, setUserId] = useState<number | null>(null);

	const elementIds = useElementIds(['report-user', 'report-period'] as const);

	const { suggestions, isFetching } = useRemoteAutocomplete<UserModel>({
		query: searchUser,
		queryKey: ['s-report-driver'],
		queryFn: async (term) => {
			const res: FindFunctionResponseType<UserModel> | undefined =
				await requestFind('user', {
					filter: { term, role: UserRoleEnum.DRIVER },
					limit: 10,
				});

			return res?.entries ?? [];
		},
	});

	const handleExport = () => {
		if (!userId || !period) {
			return;
		}

		const url = buildExportReportUrl(userId, period);

		// Native navigation rather than a fetch+blob dance — the backend's
		// `Content-Disposition: attachment` header is what triggers the browser's
		// download, so a plain link click is all that's needed.
		const link = document.createElement('a');
		link.href = url;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	return (
		// `.form-section` is what makes the shared form fields position their
		// icons (e.g. the autocomplete's clear button) correctly — see
		// `.form-section .form-element ...` in globals.css. It isn't itself the
		// layout container, hence the nested row div.
		<div className="form-section">
			<div className="flex flex-wrap items-end gap-3">
				<FormComponentAutoComplete<ReportFormFields, UserModel>
					labelText="Driver"
					id={elementIds['report-user']}
					fieldName="user"
					fieldValue={searchUser}
					className="w-56"
					disabled={false}
					placeholderText="Search driver..."
					onInputChange={(value) => {
						setSearchUser(value);
						setUserId(null);
					}}
					autoCompleteProps={{
						suggestions,
						isLoading: isFetching,
						onSelect: (m) => {
							setSearchUser(displayUserLabel(m));
							setUserId(m.id);
						},
						getOptionLabel: (m) => displayUserLabel(m),
						getOptionKey: (m) => m.id,
					}}
				/>

				<FormComponentSelect<ReportFormFields>
					labelText="Period"
					id={elementIds['report-period']}
					fieldName="period"
					fieldValue={period}
					className="w-44"
					disabled={false}
					options={periodOptions}
					onChange={setPeriod}
				/>

				<Button
					onClick={handleExport}
					disabled={!userId}
					className="gap-1.5"
				>
					<Download className="h-4 w-4" />
					Export
				</Button>
			</div>
		</div>
	);
}
