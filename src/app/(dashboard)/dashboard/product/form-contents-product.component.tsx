import { useState } from 'react';
import {
	FormComponentInput,
	FormComponentTextarea,
} from '@/components/form/form-element.component';
import { cn } from '@/helpers/css.helper';
import { renderMarkdown } from '@/helpers/markdown.helper';
import type { ProductContentType } from '@/models/product.model';
import { type Language, LanguageEnum } from '@/types/common.type';
import type { PageMeta } from '@/types/page-meta.type';

const languages = Object.values(LanguageEnum);

/** The per-language errors one translation can carry, as `accumulateZodErrors` shapes them. */
export type ProductContentErrorsType = {
	label?: string[];
	slug?: string[];
	description?: string[];
	meta?: {
		title?: string[];
		description?: string[];
		keywords?: string[];
	};
};

/**
 * The translation panel every product-shaped form edits: label, slug, markdown description and
 * the SEO meta, one language at a time.
 *
 * Shared by the product form and the bundle form because both write the same `contents` array to
 * the same endpoint - a bundle is a product, and its wording is not a different problem. The
 * panel owns the selected language and the preview toggle; the host owns the array and the
 * hidden field that submits it, since only the host knows the rest of its payload.
 */
export function FormContentsProduct({
	contents,
	pending,
	elementIdPrefix,
	contentsError,
	contentErrors,
	onChange,
}: {
	contents: ProductContentType[];
	pending: boolean;
	/** Namespaced by the host so two forms on one page cannot collide on element ids. */
	elementIdPrefix: string;
	/** The "at least one translation" message, which belongs to the array rather than a row. */
	contentsError?: string[];
	/** Resolved by the host per language - it holds the error tree the pipeline returned. */
	contentErrors: (language: Language) => ProductContentErrorsType | undefined;
	onChange: (contents: ProductContentType[]) => void;
}) {
	const [language, setLanguage] = useState<Language>(languages[0]);
	const [previewed, setPreviewed] = useState<
		Partial<Record<Language, boolean>>
	>({});

	const contentsMap = Object.fromEntries(
		contents.map((content) => [content.language, content]),
	) as Partial<Record<Language, ProductContentType>>;

	const isPreviewed = previewed[language] ?? false;

	const errors = contentErrors(language);

	const writeContent = (patch: Partial<ProductContentType>) => {
		const current = contentsMap[language];

		const next: ProductContentType = {
			language,
			label: '',
			slug: '',
			description: null,
			// `title` is the one required key on `PageMeta`, so a fresh translation starts with
			// it explicitly null rather than absent.
			meta: { title: null },
			...current,
			...patch,
		};

		const others = contents.filter(
			(content) => content.language !== language,
		);

		onChange([...others, next]);
	};

	const handleMetaChange = (field: keyof PageMeta, value: string) => {
		writeContent({
			meta: {
				title: null,
				...contentsMap[language]?.meta,
				[field]: value,
			},
		});
	};

	return (
		<div className="form-section pt-4">
			<fieldset className="flex items-center gap-2">
				<legend className="sr-only">Content language</legend>
				<span className="text-sm font-medium" aria-hidden="true">
					Language
				</span>
				{languages.map((value) => (
					<button
						key={value}
						type="button"
						aria-pressed={value === language}
						disabled={pending}
						onClick={() => setLanguage(value)}
						className={cn(
							'rounded-md border px-3 py-1 text-sm transition-colors',
							value === language
								? 'border-focus bg-accent-soft font-medium'
								: 'border-border opacity-70 hover:opacity-100',
						)}
					>
						{value.toUpperCase()}
					</button>
				))}
			</fieldset>

			{contentsError?.length ? (
				<p className="text-sm text-danger">{contentsError.join(' ')}</p>
			) : null}

			<FormComponentInput<ProductContentType>
				id={`${elementIdPrefix}-${language}-label`}
				labelText="Label"
				fieldName="label"
				fieldValue={contentsMap[language]?.label ?? ''}
				isRequired={true}
				disabled={pending}
				onChange={(e) => writeContent({ label: e.target.value })}
				error={errors?.label}
			/>

			<FormComponentInput<ProductContentType>
				id={`${elementIdPrefix}-${language}-slug`}
				labelText="Slug"
				fieldName="slug"
				fieldValue={contentsMap[language]?.slug ?? ''}
				isRequired={true}
				placeholderText="eg: pizza-margherita"
				disabled={pending}
				onChange={(e) => writeContent({ slug: e.target.value })}
				error={errors?.slug}
			/>

			<div className="space-y-2">
				<div className="flex items-center justify-between">
					{/*
					 * The label is hand-rolled so the preview toggle can sit beside it, which is
					 * also why the field below carries no label of its own.
					 */}
					<span className="text-sm font-medium">Description</span>
					<button
						type="button"
						className="text-sm underline opacity-70 hover:opacity-100"
						onClick={() =>
							setPreviewed((current) => ({
								...current,
								[language]: !isPreviewed,
							}))
						}
					>
						{isPreviewed ? 'Edit' : 'Preview'}
					</button>
				</div>

				{isPreviewed ? (
					// Sanitized by `renderMarkdown`; see the helper for why the two steps stay
					// together.
					<div
						// Matches the measured height of the 10-row textarea it replaces, so
						// toggling Preview on an empty draft does not collapse the panel.
						className="markdown-body min-h-52 rounded-md border border-line p-3"
						// biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendered and sanitized by `renderMarkdown`
						dangerouslySetInnerHTML={{
							__html: renderMarkdown(
								contentsMap[language]?.description,
							),
						}}
					/>
				) : (
					<FormComponentTextarea<ProductContentType>
						id={`${elementIdPrefix}-${language}-description`}
						labelText=""
						fieldName="description"
						fieldValue={contentsMap[language]?.description ?? ''}
						rows={10}
						placeholderText="Describe the product in markdown…"
						disabled={pending}
						onChange={(e) =>
							writeContent({ description: e.target.value })
						}
						error={errors?.description}
					/>
				)}
			</div>

			<FormComponentInput<PageMeta>
				id={`${elementIdPrefix}-${language}-meta-title`}
				labelText="Meta Title"
				fieldName="title"
				fieldValue={contentsMap[language]?.meta?.title ?? ''}
				disabled={pending}
				onChange={(e) => handleMetaChange('title', e.target.value)}
				error={errors?.meta?.title}
			/>

			<FormComponentInput<PageMeta>
				id={`${elementIdPrefix}-${language}-meta-description`}
				labelText="Meta Description"
				fieldName="description"
				fieldValue={contentsMap[language]?.meta?.description ?? ''}
				disabled={pending}
				onChange={(e) =>
					handleMetaChange('description', e.target.value)
				}
				error={errors?.meta?.description}
			/>

			<FormComponentInput<PageMeta>
				id={`${elementIdPrefix}-${language}-meta-keywords`}
				labelText="Meta Keywords"
				fieldName="keywords"
				fieldValue={contentsMap[language]?.meta?.keywords ?? ''}
				disabled={pending}
				onChange={(e) => handleMetaChange('keywords', e.target.value)}
				error={errors?.meta?.keywords}
			/>
		</div>
	);
}
