/**
 * The documents that carry a human-facing reference. One series per document type, which is
 * what an allocation resolves on — mirrors `DocumentTypeEnum` on the backend entity.
 */
export const DocumentTypeEnum = {
	CMR: 'cmr',
} as const;

export type DocumentType =
	(typeof DocumentTypeEnum)[keyof typeof DocumentTypeEnum];

/**
 * Display labels for the document types. A label map rather than `formatEnumLabel`, which
 * title-cases word by word and would render the acronym `cmr` as "Cmr".
 */
export const DocumentTypeLabels: Record<DocumentType, string> = {
	[DocumentTypeEnum.CMR]: 'CMR',
};

// Mirror the column defaults and constraints on the backend entity/validator
export const DOCUMENT_SERIES_DEFAULT_START_NUMBER = 1;
export const DOCUMENT_SERIES_CODE_MAX_CHARS = 10;

/**
 * A series carries only what is allocated — the code and the running number. How the two are
 * rendered into a reference is a display choice made by whatever shows it (for CMRs, that is
 * `displayCmrReference` in `cmr.model.ts`), so there is no template or padding here.
 *
 * No `deleted_at`: the backend table has no soft delete, because a soft-deleted row would
 * keep its `document_type` taken while disappearing from every query, and the next
 * allocation would fail rather than continue the counter.
 */
export type DocumentSeriesModel<D = Date | string> = {
	id: number;

	document_type: DocumentType;
	code: string;
	start_number: number;
	next_number: number;
	notes: string | null;

	created_at: D;
	updated_at: D;
};

export const displayDocumentSeriesLabel = (entry: DocumentSeriesModel) => {
	return entry.code;
};
