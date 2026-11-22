'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Configuration } from '@/config/settings.config';
import { cn } from '@/helpers/css.helper';
import { numberWithSign, replaceVars } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import { requestStatsSumRevenues } from '@/services/stats.service';

const TRANSLATION_KEYS = [
	'dashboard.text.could_not_retrieve_revenues',
	'dashboard.text.failed_to_retrieve_revenues',
	'dashboard.text.change_from_last_month',
] as const;

export function SumRevenues() {
	const { translations } = useTranslation(TRANSLATION_KEYS);

	const { data, isLoading, isError } = useQuery({
		queryKey: ['stats', 'sum-revenues'],
		queryFn: () => requestStatsSumRevenues(),
		staleTime: 20 * 60 * 1000,
	});

	if (isLoading) {
		return (
			<>
				<Skeleton className="h-8 w-16 mb-2" />
				<Skeleton className="h-3 w-32" />
			</>
		);
	}

	if (isError) {
		return (
			<div className="text-danger">
				{translations['dashboard.text.failed_to_retrieve_revenues']}
			</div>
		);
	}

	if (!data) {
		return (
			<div className="text-muted">
				{translations['dashboard.text.could_not_retrieve_revenues']}
			</div>
		);
	}

	return (
		<>
			<div className="text-2xl font-bold">
				{data.value}{' '}
				<span className="text-lg">{Configuration.currency()}</span>
			</div>
			<div
				className={cn(
					'flex items-center text-xs mt-1',
					data.trend === 'up' ? 'text-success' : 'text-danger',
				)}
			>
				{data.trend === 'up' ? (
					<TrendingUp className="h-3 w-3 mr-1" />
				) : (
					<TrendingDown className="h-3 w-3 mr-1" />
				)}
				{replaceVars(
					translations['dashboard.text.change_from_last_month'],
					{
						change: numberWithSign(data.change),
					},
				)}
			</div>
		</>
	);
}
