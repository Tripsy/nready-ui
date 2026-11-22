import type { ReactNode } from 'react';

/**
 * Renders a translated sentence whose `{{slot}}` is an element rather than text - a term in
 * `<strong>`, a link - by splitting the template on the slot. One key carries the whole sentence,
 * so a translation can move the slot wherever its grammar puts it.
 *
 * An undefined template (translations still loading) renders nothing; a template without the
 * slot renders as plain text and drops `children`.
 */
export function SlotText({
	template,
	slot,
	children,
}: {
	template: string | undefined;
	slot: string;
	children: ReactNode;
}) {
	if (!template) {
		return null;
	}

	const marker = `{{${slot}}}`;
	const at = template.indexOf(marker);

	if (at === -1) {
		return <>{template}</>;
	}

	return (
		<>
			{template.slice(0, at)}
			{children}
			{template.slice(at + marker.length)}
		</>
	);
}
