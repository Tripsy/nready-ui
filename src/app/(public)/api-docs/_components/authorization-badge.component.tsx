import { Badge } from '@/components/ui/badge';
import type { ApiDocsAuthorization } from '@/types/api-docs.type';

const VARIANT: Record<
	ApiDocsAuthorization,
	'success' | 'warning' | 'secondary'
> = {
	none: 'success',
	partial: 'warning',
	required: 'secondary',
};

/**
 * How much of a module needs a bearer token, as a label. Green reads as "you can call this
 * now" rather than as "safe" - the point of the color is what a reader can do with it.
 */
export function AuthorizationBadge({
	authorization,
	label,
}: {
	authorization: ApiDocsAuthorization;
	label: string;
}) {
	return (
		<Badge variant={VARIANT[authorization]} size="xs">
			{label}
		</Badge>
	);
}
