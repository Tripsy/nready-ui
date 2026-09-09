'use client';

import type { JSX } from 'react';
import {
	type ReviewTranslations,
	reviewDimensionLabelKey,
} from '@/components/review/review.definition';
import { ReviewStars } from '@/components/review/review-stars.component';
import {
	REVIEW_RATING_DIMENSIONS,
	REVIEW_RATING_MAX,
	type ReviewSummaryType,
} from '@/models/review.model';

/**
 * The score beside a product: the average as stars, how many reviews stand behind it, the spread
 * over whole stars, and the average per dimension.
 *
 * Everything here is over **approved** reviews only, which is why the reader's own pending review
 * does not move it - the note on that review says so rather than this pretending otherwise.
 */
export function ReviewSummary({
	summary,
	translations,
}: {
	summary: ReviewSummaryType;
	translations: ReviewTranslations;
}): JSX.Element {
	const scored = REVIEW_RATING_DIMENSIONS.filter(
		(dimension) => typeof summary.dimensions[dimension] === 'number',
	);

	return (
		<div>
			<div className="flex items-baseline gap-2">
				<span className="text-3xl font-semibold">
					{summary.average}
				</span>
				<span className="text-muted">/ {REVIEW_RATING_MAX}</span>
			</div>

			<div className="mt-2 flex items-center gap-2">
				<ReviewStars value={summary.average} />
				<span className="text-sm text-muted">
					{translations['section.count'].replace(
						'{{total}}',
						String(summary.total),
					)}
				</span>
			</div>
			<div className="grid gap-6 sm:grid-cols-2 mt-4">
				<div>
					{/*
					 * Highest first, which is the order these are read in, and every step is drawn
					 * even at zero - a missing row would make five stars look like four.
					 */}
					<ul className="space-y-1.5">
						{Array.from(
							{ length: REVIEW_RATING_MAX },
							(_, index) => REVIEW_RATING_MAX - index,
						).map((stars) => {
							const count = summary.distribution[stars] ?? 0;
							const share =
								summary.total > 0
									? (count / summary.total) * 100
									: 0;

							return (
								<li
									key={stars}
									className="flex items-center gap-2 text-sm"
								>
									<span className="w-8 shrink-0 text-muted">
										{stars}★
									</span>

									<span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
										<span
											className="block h-full rounded-full bg-warning"
											style={{ width: `${share}%` }}
										/>
									</span>
								</li>
							);
						})}
					</ul>
				</div>

				{/*
				 * Per dimension, and only the ones somebody scored: the backend leaves an unscored
				 * dimension out of the aggregate rather than returning a zero, so an absent key here
				 * means "nobody said", which is not a bad mark.
				 */}
				{scored.length > 0 && (
					<div>
						<ul className="space-y-2">
							{scored.map((dimension) => {
								const value = summary.dimensions[
									dimension
								] as number;

								return (
									<li
										key={dimension}
										className="grid grid-cols-[100px_1fr] items-center gap-3 text-sm"
									>
										<span className="text-muted">
											{
												translations[
													reviewDimensionLabelKey(
														dimension,
													)
												]
											}
										</span>

										<span className="flex items-center gap-2">
											<ReviewStars
												value={value}
												size="sm"
											/>
										</span>
									</li>
								);
							})}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}
