## Download retries and resumption

Date: 2026-10-08

Use Undici's RetryAgent for interrupted package downloads.

### Rationale

RetryAgent handles HTTP retry policy, byte ranges, representation validators and
backpressure together. Got's stream retry API requires the caller to recreate the
stream and manage its file position, leaving more of the resume protocol here.
The operations wrapper enforces HTTPS redirects, bounds the total attempts, reports
retries and restarts the whole file when resumption is unavailable. Archive and
per-file SHA-256 verification remain the package readers' responsibility.
