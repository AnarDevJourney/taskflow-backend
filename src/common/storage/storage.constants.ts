// DI token for the raw MinIO SDK client. Everything in the app talks to
// storage through MinioService — the token exists so the client itself can be
// swapped (or mocked in tests) without touching a single consumer.
export const MINIO_CLIENT = 'MINIO_CLIENT';

// Second client, pointed at the browser-facing MinIO address, used only to
// sign download URLs. A SigV4 presigned URL covers the Host header, so a URL
// signed for the in-cluster hostname (`minio:9000`) is rejected the moment a
// browser requests it through the public one — the host has to be right at
// signing time, not patched in afterwards.
export const MINIO_PRESIGN_CLIENT = 'MINIO_PRESIGN_CLIENT';

// Objects under this prefix are readable anonymously (see MinioService.
// applyPublicPolicy) — avatars and workspace logos live here so they can be
// used directly in <img src>. Everything else stays private and is only
// reachable through a time-limited presigned URL.
export const PUBLIC_PREFIX = 'public';
