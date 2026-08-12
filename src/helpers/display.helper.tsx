import clsx from 'clsx';
import Image from 'next/image';
import { type ComponentType, type JSX, useState } from 'react';
import { Icons } from '@/components/icon.component';
import {
	Badge,
	type BadgeSize,
	type BadgeVariant,
} from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent } from '@/components/ui/popover';
import { getLanguageClient } from '@/config/translate.setup';
import { cn } from '@/helpers/css.helper';
import { useTranslation } from '@/hooks/use-translation.hook';
import type { CmrSessionModel } from '@/models/cmr-session.model';
import { displayWorkSessionLabel } from '@/models/work-session.model';
import type { DataSourceKey } from '@/types/data-source.key';

export const statusList: Record<
	string,
	{ variant: BadgeVariant; icon: ComponentType<{ className?: string }> }
> = {
	active: {
		variant: 'success',
		icon: Icons.Status.Active,
	},
	pending: {
		variant: 'warning',
		icon: Icons.Status.Pending,
	},
	inactive: {
		variant: 'error',
		icon: Icons.Status.Inactive,
	},
	deleted: {
		variant: 'default',
		icon: Icons.Status.Deleted,
	},
	ok: {
		variant: 'success',
		icon: Icons.Status.Ok,
	},
	error: {
		variant: 'error',
		icon: Icons.Status.Error,
	},
	warning: {
		variant: 'warning',
		icon: Icons.Status.Warning,
	},
	sent: {
		variant: 'success',
		icon: Icons.Status.Sent,
	},
	authorized: {
		variant: 'success',
		icon: Icons.Status.Authorized,
	},
	completed: {
		variant: 'success',
		icon: Icons.Status.Ok,
	},
	failed: {
		variant: 'error',
		icon: Icons.Status.Failed,
	},
	canceled: {
		variant: 'warning',
		icon: Icons.Status.Canceled,
	},
	expired: {
		variant: 'warning',
		icon: Icons.Status.Expired,
	},
	requires_action: {
		variant: 'default',
		icon: Icons.Status.RequiresAction,
	},
	verified: {
		variant: 'success',
		icon: Icons.Status.Verified,
	},
	draft: {
		variant: 'warning',
		icon: Icons.Status.Draft,
	},
	in_use: {
		variant: 'success',
		icon: Icons.Status.InUse,
	},
	damaged: {
		variant: 'error',
		icon: Icons.Status.Damaged,
	},
	sold: {
		variant: 'default',
		icon: Icons.Status.Sold,
	},
	scrapped: {
		variant: 'warning',
		icon: Icons.Status.Scrapped,
	},
	closed: {
		variant: 'error',
		icon: Icons.Status.Closed,
	},
	assigned: {
		variant: 'default',
		icon: Icons.Status.Assigned,
	},
	returned: {
		variant: 'warning',
		icon: Icons.Status.Returned,
	},
	ordered: {
		variant: 'default',
		icon: Icons.Status.Ordered,
	},
	preparing: {
		variant: 'default',
		icon: Icons.Status.Preparing,
	},
	transit: {
		variant: 'default',
		icon: Icons.Status.Transit,
	},
	delivered: {
		variant: 'success',
		icon: Icons.Status.Delivered,
	},
	delayed: {
		variant: 'warning',
		icon: Icons.Status.Delayed,
	},
};

export const DisplayStatus = ({
	status,
	dataSource,
	variant,
	size,
	icon: Icon,
}: {
	status: keyof typeof statusList;
	dataSource: DataSourceKey;
	variant?: BadgeVariant;
	size?: BadgeSize;
	icon?: ComponentType<{ className?: string }>;
}) => {
	const translationsKeys = [`${dataSource}.status.${status}`] as const;

	const { translations } = useTranslation(translationsKeys);
	const { variant: statusVariant, icon: StatusIcon } =
		statusList[status] || {};

	const computedVariant = variant || statusVariant || 'default';
	const computedSize = size || 'status';
	const ComputedIcon = Icon || StatusIcon;

	return (
		<Badge
			variant={computedVariant}
			size={computedSize}
			className="min-w-28 opacity-70 hover:opacity-100"
		>
			{ComputedIcon && <ComputedIcon className="w-4 h-4" />}
			{translations[`${dataSource}.status.${status}`] || status}
		</Badge>
	);
};

export const DisplayDeleted = ({
	value,
	isDeleted,
}: {
	value: string | JSX.Element;
	isDeleted: boolean;
}) => {
	return <div className={clsx(isDeleted && 'line-through')}>{value}</div>;
};

/**
 * Formats an amount for display, returning the number and its currency symbol separately so a
 * caller can style or place them independently.
 *
 * Grouping and decimal separators follow **the language the UI is rendered in**, not the
 * viewer's browser: `1,234.50` under `en`, `1.234,50` under `ro`. Two people reading the same
 * screen in the same language therefore see the same figures, and a screenshot in a bug report
 * matches what the reporter saw.
 *
 * The function lives here rather than in `string.helper` because it needs
 * `getLanguageClient()`, and `translate.setup` imports `string.helper`
 *
 * Client-only — `getLanguageClient()` reads `html[lang]`. Every amount in the app is rendered
 * client-side, which is what keeps this consistent (a server render would fall back to the
 * container's locale).
 */
export function formatAmount(amount: number, currencyCode: string) {
	const language = getLanguageClient();

	const numberFormatter = new Intl.NumberFormat(language, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});

	const symbolFormatter = new Intl.NumberFormat(language, {
		style: 'currency',
		currency: currencyCode,
		currencyDisplay: 'narrowSymbol',
	});

	// `formatToParts(0)` is only a vehicle for extracting the symbol — the zero is discarded.
	const parts = symbolFormatter.formatToParts(0);
	const currency =
		parts.find((part) => part.type === 'currency')?.value ?? currencyCode;

	return {
		value: numberFormatter.format(amount),
		currency,
	};
}

/**
 * Displays a formatted amount, styling negative values distinctly.
 *
 * @param {Object} props - Component props
 * @param {number} props.amount - Signed amount; negative values take `classNameNegative`
 * @param {string} props.currencyCode - Currency code (e.g., RON, USD, EUR)
 * @returns {JSX.Element} Formatted amount span with currency and conditional styling
 *
 * @example
 * <DisplayAmount amount={100} currencyCode="RON" />
 *
 * @example
 * <DisplayAmount amount={-50} currencyCode="EUR" />
 */
export function DisplayAmount({
	amount,
	currencyCode,
	classNameNegative = 'text-danger dark:text-warning',
	classNamePositive,
}: {
	amount: number;
	currencyCode: string;
	classNameNegative?: string;
	classNamePositive?: string;
}): JSX.Element {
	const formatted = formatAmount(amount, currencyCode);

	return (
		<span className={amount < 0 ? classNameNegative : classNamePositive}>
			{formatted.value} {formatted.currency}
		</span>
	);
}

export function displayColumnSession(cmr_sessions: CmrSessionModel[]) {
	const lastSession = cmr_sessions.reduce(
		(max, entry) => (entry.id > max.id ? entry : max),
		cmr_sessions[0],
	);

	if (!lastSession) {
		return '-';
	}

	return (
		<div className="flex items-center gap-2">
			<DisplayStatus
				status={lastSession.work_session.status}
				dataSource="work-session"
			/>
			{displayWorkSessionLabel(lastSession.work_session)}
		</div>
	);
}

type ImagePreviewProps = {
	src: string;
	alt: string;
	className?: string;
	width?: number;
	height?: number;
};

/**
 * The popover's open state has to live in a real component rather than in `displayImage`
 * itself. `displayImage` is invoked as a plain function — the `.definition.ts` files that
 * call it cannot hold JSX — so a `useState` inside it would run in the *caller's* hook
 * slot, once per row in a data table body, and any conditional row would shift hook order.
 */
function ImagePreview({
	src,
	alt,
	className,
	width = 64,
	height = 64,
}: ImagePreviewProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Popover isOpen={isOpen} onOpenChange={setIsOpen}>
			<Popover.Trigger
				className="cursor-pointer relative group"
				aria-label={`View larger version of ${alt}`}
			>
				<Image
					src={src}
					alt={alt}
					className={cn('h-full w-full object-contain', className)}
					width={width}
					height={height}
				/>
			</Popover.Trigger>
			<PopoverContent
				className="shadow-xl overflow-hidden w-auto h-auto max-w-[80vw] max-h-[80vh]"
				placement="right"
				// The overlay stays open until the close button is pressed: react-aria
				// never requests a close for outside interaction or Escape, so
				// `onOpenChange` can be wired straight to state.
				shouldCloseOnInteractOutside={() => false}
				isKeyboardDismissDisabled
			>
				<div className="relative w-auto h-auto max-w-[80vw] max-h-[80vh]">
					<Image
						src={src}
						alt={alt}
						className="object-contain"
						width={800}
						height={800}
						sizes="80vw"
						priority
						style={{
							maxWidth: '80vw',
							maxHeight: '80vh',
							width: 'auto',
							height: 'auto',
						}}
					/>

					<Button
						variant="ghost"
						onClick={() => setIsOpen(false)}
						className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10 cursor-pointer"
						aria-label="Close"
						title="Close"
					>
						<Icons.Close className="h-5 w-5" />
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}

export function displayImage(props: ImagePreviewProps) {
	return <ImagePreview {...props} />;
}
