'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Configuration } from '@/config/settings.config';
import { cn } from '@/helpers/css.helper';
import { numberWithSign } from '@/helpers/string.helper';
import { requestStatsSumExpenses } from '@/services/stats.service';

export function SumExpenses() {
	const { data, isLoading, isError } = useQuery({
		queryKey: ['stats', 'sum-expenses'],
		queryFn: () => requestStatsSumExpenses(),
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
		return <div className="text-danger">Failed to retrieve expenses</div>;
	}

	if (!data) {
		return <div className="text-muted">Could not retrieve expenses</div>;
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
					// Inverted vs. the revenue tiles: for a cost metric, rising
					// is the bad outcome.
					data.trend === 'up' ? 'text-danger' : 'text-success',
				)}
			>
				{data.trend === 'up' ? (
					<TrendingUp className="h-3 w-3 mr-1" />
				) : (
					<TrendingDown className="h-3 w-3 mr-1" />
				)}
				{numberWithSign(data.change)}% from last month
			</div>
		</>
	);
}
