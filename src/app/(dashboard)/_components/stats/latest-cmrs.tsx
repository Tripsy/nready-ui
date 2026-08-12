'use client';

import { useQuery } from '@tanstack/react-query';
import { Icons } from '@/components/icon.component';
import { Skeleton } from '@/components/ui/skeleton';
import { getLanguageClient } from '@/config/translate.setup';
import { DisplayStatus } from '@/helpers/display.helper';
import { displayAddressLabel } from '@/models/address.model';
import { displayClientLabel } from '@/models/client.model';
import { displayUserLabel } from '@/models/user.model';
import { requestStatsLatestCMRs } from '@/services/stats.service';

function LatestCMRsSkeleton() {
	const items = Array.from({ length: 5 }, (_, i) => ({
		id: `cmr-${i}`,
	}));

	return (
		<div className="space-y-4">
			{items.map((v) => (
				<div key={v.id} className="flex items-center justify-between">
					<div className="flex items-center gap-3">
						<Skeleton className="h-8 w-8 rounded-full" />
						<Skeleton className="h-4 w-32" />
					</div>
					<div className="flex items-center gap-2">
						<Skeleton className="h-3 w-16" />
						<Skeleton className="h-4 w-4" />
					</div>
				</div>
			))}
		</div>
	);
}

export function LatestCMRs() {
	const { data, isLoading, isError } = useQuery({
		queryKey: ['stats', 'latest-cmrs'],
		queryFn: () => requestStatsLatestCMRs(),
		// staleTime: 10 * 60 * 1000,
		staleTime: 0,
	});

	if (isLoading) {
		return <LatestCMRsSkeleton />;
	}

	if (isError) {
		return <div className="text-danger">Failed to load latest CMRs</div>;
	}

	if (!data || data.length === 0) {
		return <div className="text-muted">No CMRs found</div>;
	}

	const language = getLanguageClient();

	return (
		<div className="space-y-4">
			{data.map((entry) => {
				const driver = entry.cmr_sessions[0]?.work_session.user;

				const pickupAddress = entry.pickup_address
					? displayAddressLabel(entry.pickup_address, language)
					: null;
				const deliveryAddress = entry.delivery_address
					? entry.delivery_address.city?.id ===
						entry.pickup_address.city?.id
						? entry.delivery_address.details
						: displayAddressLabel(entry.delivery_address, language)
					: null;

				return (
					<div
						key={entry.id}
						className="flex items-center justify-between"
					>
						<div className="flex items-center gap-3">
							<span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-secondary text-sm font-medium">
								#{entry.id}
							</span>
							<div className="flex flex-col gap-2">
								<div className="font-medium">
									{displayClientLabel(entry.client)}
								</div>
								<div className="flex gap-2 items-center text-sm">
									{pickupAddress}
									<Icons.Direction.ArrowRight className="h-3 w-3" />
									{deliveryAddress}
								</div>
								{driver && (
									<div className="flex gap-2 items-center text-sm">
										<Icons.User className="h-3 w-3" />{' '}
										{displayUserLabel(driver)}
									</div>
								)}
							</div>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-sm text-muted">
								<DisplayStatus
									status={entry.status}
									dataSource="cmr"
								/>
							</span>
						</div>
					</div>
				);
			})}
		</div>
	);
}
