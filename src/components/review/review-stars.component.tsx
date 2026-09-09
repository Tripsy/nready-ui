import type { JSX } from 'react';
import { Icons } from '@/components/icon.component';
import { cn } from '@/helpers/css.helper';
import { REVIEW_RATING_MAX } from '@/models/review.model';

/**
 * A score as stars, rounded to the nearest half and rendered as a filled star, a half star or an
 * outline per position.
 *
 * The number stays beside it wherever this is used: five stars are a shape people read at a
 * glance and misread by one, and the exact average is what the copy actually claims.
 */
export function ReviewStars({
	value,
	size = 'md',
}: {
	value: number;
	size?: 'sm' | 'md';
}): JSX.Element {
	// Halves rather than full steps: 4.4 and 4.6 both round to 4 stars, which reads as the same
	// product, and the half is the smallest distinction a row of five can carry honestly.
	const filled = Math.round(value * 2) / 2;

	const className = cn(
		'text-warning',
		size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4',
	);

	return (
		// `img` with a label rather than a bare span: five stars are one graphic, and a screen
		// reader should hear the score once instead of five icon names.
		<span
			role="img"
			className="inline-flex items-center gap-0.5"
			aria-label={`${value} / ${REVIEW_RATING_MAX}`}
		>
			{Array.from({ length: REVIEW_RATING_MAX }, (_, index) => {
				const position = index + 1;

				if (filled >= position) {
					return (
						<Icons.Star
							key={position}
							className={cn(className, 'fill-current')}
						/>
					);
				}

				if (filled >= position - 0.5) {
					return (
						<Icons.StarHalf key={position} className={className} />
					);
				}

				return (
					<Icons.Star
						key={position}
						className={cn(className, 'opacity-30')}
					/>
				);
			})}
		</span>
	);
}

/**
 * The scoring control: five buttons, and a sixth that takes the score back.
 *
 * Buttons rather than a radio group, because a score is optional per dimension and a radio, once
 * chosen, cannot be unchosen - and an unscored dimension is not the same as a low one. The value
 * rides in a hidden input, since `processForm` reads everything it sends out of the `FormData`.
 */
export function ReviewStarsInput({
	name,
	label,
	value,
	disabled,
	clearLabel,
	onChange,
}: {
	name: string;
	label: string;
	value: number | null;
	disabled?: boolean;
	clearLabel: string;
	onChange: (value: number | null) => void;
}): JSX.Element {
	return (
		<div className="flex items-center gap-3">
			<span className="w-24 shrink-0 text-sm text-muted">{label}</span>

			<input type="hidden" name={name} value={value ?? ''} />

			<span className="inline-flex items-center gap-0.5">
				{Array.from({ length: REVIEW_RATING_MAX }, (_, index) => {
					const score = index + 1;
					const isOn = (value ?? 0) >= score;

					return (
						<button
							key={score}
							type="button"
							disabled={disabled}
							aria-label={`${label}: ${score} / ${REVIEW_RATING_MAX}`}
							aria-pressed={isOn}
							onClick={() => onChange(score)}
							className="cursor-pointer disabled:opacity-60"
						>
							{isOn ? (
								<Icons.Star className="h-5 w-5 fill-current text-warning" />
							) : (
								<Icons.Star className="h-5 w-5 text-muted opacity-40 hover:opacity-80" />
							)}
						</button>
					);
				})}
			</span>

			{/* Offered only once there is a score to remove, so an untouched row carries no
			    control that would do nothing. */}
			{value !== null && !disabled && (
				<button
					type="button"
					onClick={() => onChange(null)}
					className="text-xs text-muted hover:underline"
				>
					{clearLabel}
				</button>
			)}
		</div>
	);
}
