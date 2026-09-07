---
paths:
  - "src/app/(public)/comments/**"
  - "src/components/comment/**"
  - "src/components/complaint/**"
  - "src/components/rating/**"
  - "src/hooks/use-rating-summaries.hook.ts"
---

# Reader Widgets Protocol

**Scope:** The three public widgets a content page hosts - the comment thread, the reaction
picker, and the report control - plus how a page wires them. Form mechanics are in `forms.md`,
query conventions in `data-fetching.md`; this file covers what those cannot express.

Backend behaviour behind them (comment status model, who may write what, the automatic flagging
rule) is in `../nready-api/.claude/rules/comment.md` - read that before changing what these send.

## 1. Entity-Agnostic by Construction

Nothing under `src/components/{comment,complaint,rating}/` knows what it is attached to. The
target is a prop (`entityType` / `entityId`), so an article renders these today and a review
renders the same ones next. Add a target by passing different props, never by branching on the
host inside a widget.

Their copy therefore lives in **their own** translation namespace (`comment`, `complaint`,
`rating`), not in the host page's - every host resolves the same keys.

## 2. Keys Cross the Server Boundary, Values Do Not

Each widget family ships a `<name>.definition.ts` that is **not** `'use client'`, holding the
translation prefix, the `*_TRANSLATION_KEYS` tuple, the `*Translations` type, the form-values
contract and the validator. The components are `'use client'` and import from it.

That split is the whole point: a `'use client'` module's value exports are replaced with client
references, so a server component spreading a key array exported from one would get something
that is not iterable. The host page batches each namespace separately and passes the result down:

```tsx
const [translations, commentTranslations, ratingTranslations, complaintTranslations, result] =
    await Promise.all([
        translateBatch(TRANSLATION_KEYS, TRANSLATION_PREFIX),
        translateBatch(COMMENT_TRANSLATION_KEYS, COMMENT_TRANSLATION_PREFIX),
        // ...
    ]);
```

`ArticleRating` is the exception that proves it - it exports a translations **type** and the page
lists its keys inline, because that component is `'use client'` and has no definition file.

## 3. Public Forms: the Thin-Action Host

A public write (post a comment, file a report) uses the auth-entry shape from `forms.md` §7 - a
`<name>.action.ts` wrapping `processForm`, wired to `useActionState` in the component - **not**
`WindowForm`. There is no data source, no permission and no window behind these; a dashboard
entity's machinery would be scaffolding around nothing.

- The action files carry no `'use server'`, which is what keeps them inside the middleware's CSRF
  gate. Don't add one, and don't call a server action from inside the pipeline (CLAUDE.md).
- Fields the reader never types - the target, and which write applies - ride as hidden inputs,
  because `processForm` reads everything it sends out of the `FormData`.
- One submit may mean two requests: `has_own` decides create vs. update for a report, the way
  `requires_guest` decides which schema validates a comment. The backend refuses the wrong one
  (409 on a second filing, 404 on amending nothing), so the branch is not cosmetic.
- A form that has submitted successfully is **remounted**, never cleared in place:
  `useFormValidation` keeps `submitted`, so blanking the fields would re-validate them as empty
  and paint a form the reader has just used successfully red. `CommentForm` bumps a `key`;
  `ComplaintReportDialog` closes, which unmounts.

## 4. Per-Visitor Reads

`own` - this visitor's vote, this reader's report - is never the same for two people and must not
be cached anywhere shared:

- `staleTime: 0` against the provider's five-minute default. A cached answer reads as the click
  having failed, and the backend does not cache these either.
- The complaint read is `enabled` on **the session and the dialog being open**. A page of comments
  mounts one dialog per row; asking about every row on arrival would be a request per comment.
  The article's trigger is the deliberate exception - it marks itself "Reported", so it asks on
  load, and shares the query key with the dialog it opens.
- Reaction counts for a **list** go through `useRatingSummaries` - one request for everything on
  screen, previews included, re-keyed as more is paged in. Never a summary request per row.

## 5. Linking to One Comment

`commentAnchorId` / `parseCommentAnchor` (`comment.definition.ts`) own the format: `comment-<id>`
for a root, `comment-<parent>-<id>` for a reply. The parent is in the fragment because a reply is
not in the DOM until its thread is unrolled - it tells the thread which list to open before the
target exists to scroll to.

`CommentThread` resolves it: read the fragment on mount **and on `hashchange`** (a link to the
page the reader is already on navigates nothing), then each attempt pages the roots, lets
`openRepliesFor` unroll the named thread, and looks again - the replies arrive through their own
query, which the effect has no other way to hear about. It gives up after
`ANCHOR_MAX_ATTEMPTS`, since a link can name a comment that has since gone.

Anything rendering a comment must keep the `id={anchorId}` and its `scroll-mt`, or the link lands
under the sticky header - or nowhere.

## 5b. A Long Comment Is Folded, Not Clamped

Past `COMMENT_EXCERPT_LENGTH` (350) a body is cut by `buildCommentExcerpt` and the rest sits behind
"… more" (`CommentBody`). Both live in `comment.definition.ts` / `comment-body.component.tsx`, so
any host of the thread gets the same behaviour.

Unfolding is **one way** - the control goes with the fold rather than turning into a "less". A
comment that folds itself back up moves everything under it while the reader is somewhere down the
thread, and nobody asks to re-hide text they just asked for.

A character count rather than a CSS line clamp, deliberately: a clamp measures rendered height, so
how much survives depends on the viewport, and the hidden text stays in the page where a browser
search finds it inside a comment that looks collapsed. The fold cuts back to a word boundary but
only within `WORD_BOUNDARY_SLACK` - a probe caught the case that rule exists for: one long
unbroken token just inside the limit pulled the cut back to the whitespace before it and showed 16
characters of a 418-character comment.

## 6. Clipboard: the Fallback Needs a Field Inside the Overlay

`copyToClipboard` (`../../src/helpers/ui.helper.ts`) is the only way anything here writes to the
clipboard - it is not comment-specific and any new copy control uses it rather than calling
`navigator.clipboard` directly.

`navigator.clipboard` is **undefined** outside a secure context - every plain-http host, the dev
server among them - so it falls back to selection plus `execCommand`, and that fallback copies from
a textarea the **caller** renders inside the overlay. A field appended to `document.body` cannot
hold the selection: react-aria's focus scope pulls focus straight back out of anything mounted
outside the overlay, `execCommand` then returns `true` having copied nothing, and the success toast
lies.

So a caller owes the helper two things: a hidden field inside its own overlay (`aria-hidden`, no tab
stop) whose ref it passes in, and the copy **before** the overlay is dismissed - closing it takes
the field with it. `comment-menu.component.tsx` is the worked example. (Observed and fixed once; a
"tidy-up" that creates the field on demand brings the bug back.)

## 7. The Comment Permalink, and the Target Registry

`/comments/:id` (`comment-link`) is what a notification email links a comment by. It reads *where*
the comment lives (`GET /public/comments/:id` → target and parent), resolves that target to a page,
and redirects to it with the anchor from §5 - `/articles/<category>/<slug>#comment-49-58`.

**The URL is built here, at click time, and stored nowhere.** A link in an inbox outlives the
address it pointed at: an article can be re-slugged or re-filed, and a URL written into an email -
or into a database column - is wrong from that moment while an id never is. It also keeps the
backend from having to know that a comment target is an article; slugs and routes are this app's.

**The page knows nothing about articles.** The backend answers with a polymorphic target
(`entity_type` + `entity_id`), and `src/config/comment-target.config.ts` maps that type to a path:

```typescript
const COMMENT_TARGET_RESOLVERS: Partial<Record<CommentEntityType, CommentTargetResolver>> = {
	[CommentEntityTypeEnum.ARTICLE]: resolveArticleTarget,
};
```

A new kind of commentable thing - a review, a product - is **one entry in that map**, never a branch
in the page. Keep the registry `Partial`: `CommentEntityTypeEnum` mirrors the backend, which already
accepts targets this app has no page for, and an unresolvable type answers null, which the page
renders as a 404. Verified both ways: an article comment redirects with its anchor, a `review`
comment 404s.

### Making a new target commentable, on this side

The backend accepting a new `entity_type` is half of it; this app owes four things, and the third
is the one that is forgotten until an emailed link 404s:

1. `CommentEntityTypeEnum` (`src/models/comment.model.ts`) gains the value - it mirrors the
   backend's enum and is what every widget below is typed on.
2. The page that hosts the discussion renders `CommentThread` with the new
   `entityType` / `entityId` and the three batched namespaces (§2). Nothing in the widgets changes.
3. **`src/config/comment-target.config.ts` gains a resolver** for that type: `(entityId, language)`
   → the path of the page from step 2, or null when the target is not reachable. Without it every
   notification permalink for that target is a 404 - the comments work, the links out of the emails
   do not, and nothing fails loudly enough to notice.
4. `COMPLAINT_*_REASONS` (`src/components/complaint/complaint.definition.ts`) if the reasons offered
   for reporting differ from the ones already defined.

A resolver is the only new code; the rest is wiring what already exists.

A resolver returns null rather than throwing when the target cannot be reached. The article one goes
through the public listing filtered by `id`, so an unpublished or unlisted-restricted article
resolves to nothing and the reader is never redirected somewhere the comment is not. Keep
`redirect()` outside any `try`: it throws to unwind, and a `catch` would swallow it.

## 8. The Unsubscribe Landing

`/comments/unsubscribe/:token` (`comment-unsubscribe` in `routes.setup.ts`) is where a notification
email's link lands. The token in the path is the entire credential - a guest subscriber has no
account - so the page is public and the read runs **server-side through `remote-api`**: there is no
session for the proxy to attach, and the answer belongs to whoever holds the link, so it is never
cached (`cache: 'no-store'`, `robots: noindex, nofollow`).

It offers all three states, not a single "unsubscribe" button: somebody following that link usually
wants *fewer* emails rather than none, and offering only the exit makes that the only answer they
can give. The save is a plain `useMutation` - one enum field, nothing to validate - and goes through
the proxy like any other write, so the CSRF header is attached for it.

A token that opens nothing renders the error state rather than a form that cannot be saved.

## 9. A Page Rendered in Somebody Else's Language

The unsubscribe landing renders in the **subscription's** language, not the visitor's: the reader
arrives from an email written in it, quite possibly in a browser that has never been to the site.

`translate` and `translateBatch` therefore take an optional trailing `language`, which overrides
`getLanguage()` and falls back to it when the value is not supported. `generateMetadata` and the
page both resolve the subscription through one memoized helper so the tab title cannot end up in a
different language from the page under it.

Use the override only where the language belongs to the *record* being shown rather than to whoever
opened the page. Everywhere else, `getLanguage()` - the visitor's own - is the right answer.

## 10. The Report Control Comes in Two Shapes

- `ComplaintReport` - trigger plus dialog, for a host with somewhere to put a button (the article,
  beside "Was this article useful?"). The trigger carries the state: marked, and reading
  "Reported", when one is already filed.
- `ComplaintReportDialog` - the dialog alone, `isOpen`/`onClose`, for a host that owns its own
  trigger (the comment menu's "Report comment"). Mount it **outside** the popover: the popover is
  dismissed as the dialog opens, and a dialog inside it would go with it.

Which reasons a target offers is a UI decision and lives in `complaint.definition.ts`
(`COMPLAINT_ARTICLE_REASONS`, `COMPLAINT_COMMENT_REASONS`). The validator mirrors the backend and
accepts all seven - the offered list is presentation, and the form still shows a reader the reason
they filed under even when it is outside the current subset.

Reporting needs an account. A signed-out reader gets the way to sign in, with the current path as
`?from=`, rather than a form that cannot be submitted.
