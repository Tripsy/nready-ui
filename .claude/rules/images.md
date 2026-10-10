---
paths:
  - "src/services/image.service.ts"
  - "src/models/image.model.ts"
  - "src/app/api/image/**"
  - "src/services/image-storage.service.ts"
  - "src/components/manager-images.component.tsx"
---

# Images

`src/services/image.service.ts` / `image-storage.service.ts` handle upload/list/delete against
the backend's `image` feature; the storage backend is `local` or `s3` (`IMAGE_STORAGE` env var,
`@aws-sdk/client-s3`).

## Public vs private sections

- `PUBLIC_IMAGE_SECTIONS` (`src/models/image.model.ts`) - `product`, `product_variant`, `article` -
  are what a signed-out visitor sees. On S3, `showImage()` renders them from the CloudFront
  distribution (`NEXT_PUBLIC_IMAGES_CDN_URL`), and `/api/image/view` signs them without a
  permission check. Every other section stays behind its entity's `read` permission and the
  signed route.
- The production bucket is private; CloudFront reads it through Origin Access Control, and the
  bucket policy grants it the public prefixes only (README, "Deployment"). **A section made
  public needs both** the list entry and the bucket-policy prefix, or its URLs answer 403.
- S3 uploads set `Cache-Control: public, max-age=31536000, immutable` - keys end in a fresh uuid,
  so a key is never rewritten. Replace an image by uploading a new key, never by overwriting.
- `NEXT_PUBLIC_IMAGES_CDN_URL` is build-time (client bundle, and `images.remotePatterns` in
  `next.config.ts`), so it is a `--build-arg` of `docker/Dockerfile.prod`.
