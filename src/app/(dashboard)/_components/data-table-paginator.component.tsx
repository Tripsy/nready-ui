import { ListBox, Pagination, Select } from '@heroui/react';
import { useCallback, useMemo } from 'react';
import { replaceVars } from '@/helpers/string.helper';
import { useTranslation } from '@/hooks/use-translation.hook';

/**
 * Page slots rendered between the previous/next buttons. The two ellipsis markers are
 * distinct values rather than a single one so each slot is its own stable React key.
 */
type PageItemType = number | 'ellipsis-start' | 'ellipsis-end';

/**
 * First and last page are always shown, plus the current page with one neighbour on
 * each side; an ellipsis stands in wherever that window skips a run. HeroUI's
 * Pagination ships only the primitives (it computes no page list of its own), so the
 * window is built here.
 */
function buildPageItems(
	currentPage: number,
	totalPages: number,
): PageItemType[] {
	// 1 … c-1 c c+1 … last — the widest list the window can produce.
	const maxItems = 7;

	if (totalPages <= maxItems) {
		return Array.from({ length: totalPages }, (_, index) => index + 1);
	}

	const windowStart = Math.max(2, currentPage - 1);
	const windowEnd = Math.min(totalPages - 1, currentPage + 1);

	const items: PageItemType[] = [1];

	if (windowStart > 2) {
		items.push('ellipsis-start');
	}

	for (let page = windowStart; page <= windowEnd; page++) {
		items.push(page);
	}

	if (windowEnd < totalPages - 1) {
		items.push('ellipsis-end');
	}

	items.push(totalPages);

	return items;
}

export type DataTablePageChangeType = {
	first: number;
	rows: number;
};

export function DataTablePaginator({
	first,
	rows,
	totalRecords,
	rowsPerPageOptions,
	onPageChange,
}: {
	first: number;
	rows: number;
	totalRecords: number;
	rowsPerPageOptions: readonly number[];
	onPageChange: (page: DataTablePageChangeType) => void;
}) {
	const translationsKeys = [
		'dashboard.text.showing_entries',
		'dashboard.text.rows_per_page',
		'dashboard.text.label_pagination',
		'dashboard.text.label_page',
		'dashboard.text.label_page_previous',
		'dashboard.text.label_page_next',
	] as const;

	const { isTranslationLoading, translations } =
		useTranslation(translationsKeys);

	const totalPages = rows > 0 ? Math.ceil(totalRecords / rows) : 0;
	const currentPage = rows > 0 ? Math.floor(first / rows) + 1 : 1;

	const pageItems = useMemo(
		() => buildPageItems(currentPage, totalPages),
		[currentPage, totalPages],
	);

	const goToPage = useCallback(
		(page: number) => onPageChange({ first: (page - 1) * rows, rows }),
		[onPageChange, rows],
	);

	// A different page size makes the current offset meaningless, so go back to page one
	// rather than trying to keep the first visible row in view.
	const changeRowsPerPage = useCallback(
		(nextRows: number) => onPageChange({ first: 0, rows: nextRows }),
		[onPageChange],
	);

	if (isTranslationLoading || totalRecords === 0) {
		return null;
	}

	const lastEntryOnPage = Math.min(first + rows, totalRecords);

	return (
		<Pagination
			aria-label={translations['dashboard.text.label_pagination']}
			className="grid grid-cols-1 items-center gap-4 pt-4 sm:grid-cols-[1fr_auto_1fr]"
		>
			<Pagination.Summary className="justify-self-start">
				{replaceVars(translations['dashboard.text.showing_entries'], {
					first: first + 1,
					last: lastEntryOnPage,
					total: totalRecords,
				})}
			</Pagination.Summary>

			<Pagination.Content className="justify-self-start sm:justify-self-center">
				<Pagination.Item>
					<Pagination.Previous
						aria-label={
							translations['dashboard.text.label_page_previous']
						}
						isDisabled={currentPage <= 1}
						onPress={() => goToPage(currentPage - 1)}
					>
						<Pagination.PreviousIcon />
					</Pagination.Previous>
				</Pagination.Item>

				{pageItems.map((item) =>
					typeof item === 'number' ? (
						<Pagination.Item key={item}>
							<Pagination.Link
								aria-label={replaceVars(
									translations['dashboard.text.label_page'],
									{ page: item },
								)}
								isActive={item === currentPage}
								onPress={() => goToPage(item)}
							>
								{item}
							</Pagination.Link>
						</Pagination.Item>
					) : (
						<Pagination.Item key={item}>
							<Pagination.Ellipsis />
						</Pagination.Item>
					),
				)}

				<Pagination.Item>
					<Pagination.Next
						aria-label={
							translations['dashboard.text.label_page_next']
						}
						isDisabled={currentPage >= totalPages}
						onPress={() => goToPage(currentPage + 1)}
					>
						<Pagination.NextIcon />
					</Pagination.Next>
				</Pagination.Item>
			</Pagination.Content>

			<Select
				aria-label={translations['dashboard.text.rows_per_page']}
				className="justify-self-start sm:justify-self-end"
				selectedKey={String(rows)}
				onSelectionChange={(key) => changeRowsPerPage(Number(key))}
			>
				<Select.Trigger className="h-9 min-w-20 items-center rounded-md border border-border shadow-none">
					<Select.Value />
					<Select.Indicator />
				</Select.Trigger>
				<Select.Popover className="rounded-md">
					<ListBox>
						{rowsPerPageOptions.map((option) => (
							<ListBox.Item
								key={option}
								id={String(option)}
								textValue={String(option)}
								className="rounded-md"
							>
								{option}
								<ListBox.Item.Indicator />
							</ListBox.Item>
						))}
					</ListBox>
				</Select.Popover>
			</Select>
		</Pagination>
	);
}
