'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type JSX, useCallback, useMemo } from 'react';
import { LoadingContent } from '@/components/status.component';
import { Button } from '@/components/ui/button';
import { getLanguageClient } from '@/config/translate.setup';
import { requestFind } from '@/helpers/services.helper';
import { hasPermission } from '@/models/account.model';
import { displayAddressLabel } from '@/models/address.model';
import { type ClientModel, displayClientLabel } from '@/models/client.model';
import {
	type ClientAddressModel,
	type ClientAddressType,
	ClientAddressTypeEnum,
} from '@/models/client-address.model';
import { useAuth } from '@/providers/auth.provider';
import { useModalStore } from '@/stores/window.store';
import type { Language } from '@/types/common.type';
import { DataSourceSectionEnum } from '@/types/data-source.type';
import type { WindowEntryType } from '@/types/window.type';

/**
 * A client holds a handful of addresses, not a page of them. The cap keeps the listing bounded;
 * it is not a limit a real client is expected to reach.
 */
const ADDRESS_LIMIT = 100;

const SECTIONS: readonly { type: ClientAddressType; title: string }[] = [
	{ type: ClientAddressTypeEnum.BILLING, title: 'Billing' },
	{ type: ClientAddressTypeEnum.DELIVERY, title: 'Delivery' },
];

type RowProps = {
	entry: ClientAddressModel;
	language: Language;
	canUpdate: boolean;
	canDelete: boolean;
	onEdit: () => void;
	onDelete: () => void;
};

function ClientAddressRow({
	entry,
	language,
	canUpdate,
	canDelete,
	onEdit,
	onDelete,
}: RowProps): JSX.Element {
	return (
		<li className="flex flex-wrap items-start gap-3 py-2">
			<div className="min-w-0 flex-1">
				<div className="font-medium">
					{entry.address
						? displayAddressLabel(entry.address, language)
						: `#${entry.address_id}`}
					{entry.address?.postal_code
						? `, ${entry.address.postal_code}`
						: ''}
				</div>
				{entry.details ? (
					<div className="text-sm">{entry.details}</div>
				) : null}
				{entry.notes ? (
					<div className="text-sm text-muted">{entry.notes}</div>
				) : null}
			</div>

			<span className="flex items-center gap-2">
				<Button
					type="button"
					variant="outline"
					hover="success"
					size="xs"
					disabled={!canUpdate}
					onClick={onEdit}
				>
					Edit
				</Button>
				<Button
					type="button"
					variant="outline"
					hover="error"
					size="xs"
					disabled={!canDelete}
					onClick={onDelete}
				>
					Delete
				</Button>
			</span>
		</li>
	);
}

/**
 * The billing and delivery addresses of one client, with a single way in below both sections.
 *
 * `client_address` is an entity of its own with its own endpoints, so the rows are fetched here
 * rather than read off the client, and the create/update/delete windows are the standard ones for
 * that data source - this is the list and the way in, the same shape as
 * `ManagerAttributesCategory`.
 */
export function ManagerAddressesClient({
	uid,
	entries,
}: {
	uid: string;
	entries: ClientModel[];
}) {
	const client = entries[0];

	const { auth } = useAuth();
	const { open, focus } = useModalStore();
	const queryClient = useQueryClient();

	const language = getLanguageClient();

	// A deleted client takes no new addresses - the backend refuses to file one against it
	const canCreate =
		!client.deleted_at && hasPermission(auth, 'client-address', 'create');
	const canUpdate = hasPermission(auth, 'client-address', 'update');
	const canDelete = hasPermission(auth, 'client-address', 'delete');

	const queryKey = useMemo(
		() => ['client', 'addresses', client.id],
		[client.id],
	);

	const { data, isLoading, isError } = useQuery({
		queryKey,
		queryFn: async () => {
			const response = await requestFind<ClientAddressModel>(
				'client-address',
				{
					filter: { client_id: client.id },
					order_by: 'id',
					direction: 'ASC',
					limit: ADDRESS_LIMIT,
				},
			);

			if (!response) {
				throw new Error('Could not retrieve the client addresses');
			}

			return response;
		},
	});

	const entriesByType = useMemo(() => {
		const grouped: Record<ClientAddressType, ClientAddressModel[]> = {
			[ClientAddressTypeEnum.BILLING]: [],
			[ClientAddressTypeEnum.DELIVERY]: [],
		};

		for (const entry of data?.entries ?? []) {
			grouped[entry.type]?.push(entry);
		}

		return grouped;
	}, [data]);

	/**
	 * Opens one of the data source's own windows and comes back here afterward.
	 *
	 * `open` minimizes every other window, this one included, so the manager is focused again on
	 * success - otherwise saving leaves the editor on an empty desktop with the list in the dock.
	 * The list is refetched rather than patched: a create answers without the joined address, and
	 * an edit may move the row to the other section.
	 */
	const openWindow = useCallback(
		(
			action: string,
			windowData: {
				entries?: WindowEntryType[];
				prefillEntry?: WindowEntryType;
			},
		) => {
			open({
				minimized: false,
				section: DataSourceSectionEnum.DASHBOARD,
				dataSource: 'client-address',
				action,
				data: windowData,
				events: {
					success: async () => {
						focus(uid);

						await queryClient.invalidateQueries({ queryKey });
					},
				},
			});
		},
		[open, focus, uid, queryClient, queryKey],
	);

	if (isLoading) {
		return <LoadingContent title="Addresses" />;
	}

	if (isError) {
		return (
			<p className="py-6 text-center text-danger">
				The addresses of this client could not be loaded.
			</p>
		);
	}

	return (
		<div className="space-y-6">
			<p className="text-sm text-muted">
				Where <strong>{displayClientLabel(client)}</strong> is billed
				and where goods are delivered.
			</p>

			{SECTIONS.map((section) => {
				const sectionEntries = entriesByType[section.type];

				return (
					<section key={section.type} className="space-y-2">
						<h3 className="border-b border-line pb-2 font-semibold">
							{section.title}
						</h3>

						{sectionEntries.length === 0 ? (
							<p className="text-sm text-muted">
								No {section.title.toLowerCase()} address yet.
							</p>
						) : (
							<ul className="divide-y divide-line">
								{sectionEntries.map((entry) => (
									<ClientAddressRow
										key={entry.id}
										entry={entry}
										language={language}
										canUpdate={canUpdate}
										canDelete={canDelete}
										onEdit={() =>
											openWindow('update', {
												entries: [entry],
											})
										}
										onDelete={() =>
											openWindow('delete', {
												entries: [entry],
											})
										}
									/>
								))}
							</ul>
						)}
					</section>
				);
			})}

			{/* One way in for both sections - the type is picked in the form, billing by default */}
			<Button
				type="button"
				variant="default"
				size="sm"
				disabled={!canCreate}
				onClick={() =>
					openWindow('create', {
						prefillEntry: {
							client_id: client.id,
						},
					})
				}
			>
				Add address
			</Button>
		</div>
	);
}
