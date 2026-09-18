---
paths:
  - "src/services/image.service.ts"
  - "src/services/image-storage.service.ts"
  - "src/components/manager-images.component.tsx"
---

# Images

`src/services/image.service.ts` / `image-storage.service.ts` handle upload/list/delete against
the backend's `image` feature; the storage backend is `local` or `s3` (`IMAGE_STORAGE` env var,
`@aws-sdk/client-s3`).
