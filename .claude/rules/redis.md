---
paths:
  - "src/helpers/cache.provider.ts"
  - "src/helpers/auth-cache.helper.ts"
  - "src/config/init-redis.config.ts"
---

# Redis

Redis is shared with nready-api - one instance, one database - so every key is namespaced by
`redis.keyPrefix` (`nready-ui` here, `nready-api` there) inside `CacheProvider.buildKey`. Not
via ioredis's own `keyPrefix` option: that one does not reach the MATCH argument of SCAN, so
`deleteByPattern` would scan the other app's keys. Build every key through `buildKey`.
