import Form from 'next/form';
import Link from 'next/link';
import { Icons } from '@/components/icon.component';
import { Button } from '@/components/ui/button';

/**
 * The catalog search box on `/products`.
 *
 * A plain GET form: `next/form` turns the submit into a client navigation to
 * `/products?term=…`, and the page reads the term from its search params. Without JS it is an
 * ordinary form submit and lands on the same URL. The input is uncontrolled, so it is keyed on
 * the term to reset it when the URL changes under it (back/forward, clear). The key has to sit
 * on the input itself: one on this server component does not reach the client tree.
 */
export function ProductSearch({
	defaultValue,
	minLength,
	translations,
}: {
	defaultValue: string;
	minLength: number;
	translations: {
		placeholder: string;
		submit: string;
		clear: string;
	};
}) {
	return (
		<Form action="/products" role="search" className="mt-8 flex gap-3">
			<div className="relative flex-1">
				<Icons.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />

				<input
					key={defaultValue}
					type="search"
					name="term"
					defaultValue={defaultValue}
					minLength={minLength}
					aria-label={translations.placeholder}
					placeholder={translations.placeholder}
					// Inset ring: an outer one grows past the button beside it. The WebKit cancel button is
					// hidden because the clear link below already does that job, and two x's read as a bug
					className="h-10 w-full rounded-md border border-border bg-field pl-9 pr-9 text-sm text-field-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus [&::-webkit-search-cancel-button]:appearance-none"
				/>

				{defaultValue !== '' && (
					<Link
						href="/products"
						aria-label={translations.clear}
						className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted transition-colors hover:text-foreground"
					>
						<Icons.Close className="h-4 w-4" />
					</Link>
				)}
			</div>

			{/* `Button` sizes itself `h-fit`; pinned to the input's height so the row lines up. */}
			<Button type="submit" className="h-10">
				{translations.submit}
			</Button>
		</Form>
	);
}
