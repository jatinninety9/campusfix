# API request security

## CSRF handshake

All state-changing requests (including login, registration, logout, issue updates and multipart photo uploads) require a CSRF cookie and an explicit `X-CSRF-Token` header. GET, HEAD and OPTIONS remain token-free. Requests without an Origin header are not exempt.

1. GET `/api/auth/csrf` with the same cookie jar/session as the intended write.
2. Read `csrfToken` from its JSON response; retain the response cookies.
3. Send that token as `X-CSRF-Token` on the write, using the same cookie jar.
4. Fetch a fresh token after login/logout or session changes. The frontend performs the handshake immediately before each write, including photo uploads.

The server uses the signed double-submit-cookie implementation from `csrf-csrf`. Tokens are HMAC-validated and bound to the current session cookie. Comparing two arbitrary matching strings is not sufficient. The cookie is HttpOnly and SameSite=Strict; production uses Secure and the `__Host-` prefix without a Domain attribute. The endpoint returns `Cache-Control: no-store`.

The signing secret is randomly generated for each API process. A restart invalidates old tokens; fetching the endpoint obtains a replacement. Multiple API instances would require a reviewed shared-secret/rotation design before horizontal scaling. Existing CLI/API clients must implement the handshake; old token-free writes intentionally return 403 with `code: CSRF_INVALID`.

Origin and Fetch Metadata checks provide additional protection. Cross-site writes, foreign hosts, scheme/port mismatches and malformed/null origins are rejected. Forwarded Host headers are not an origin allowlist.

## Rate limits

The in-memory API limiter runs before JSON parsing, authentication/database lookups and attachment routing:

| Scope | Limit |
| --- | --- |
| All `/api` requests, including health and CSRF-token reads | 600 per source IP/subnet per minute |
| Failed login/portal attempts | 40 per normalized account email per 15 minutes |
| Registration attempts | 20 per source IP/subnet per 15 minutes |
| Photo upload attempts | 20 per authenticated user per 15 minutes |

Successful logins do not consume the failed-login allowance. Limits return JSON 429 and Retry-After. Different accounts sharing a proxy do not share the account failure counter, but still share any applicable IP limits. IPv6 grouping uses the library's `ipKeyGenerator` rather than treating each IPv6 address as an unrelated client.

These counters are per process and reset on restart. They are not a global multi-instance quota, distributed DDoS protection or a substitute for edge throttling. A limiter may shed health-check traffic during overload; the health endpoint has no rate-limit bypass.

## Reverse proxy configuration

Express defaults to trusting no forwarded addresses. This prevents an arbitrary `X-Forwarded-For` value from selecting a fresh rate-limit bucket. Behind proxies, the safe default may aggregate clients into a proxy-IP bucket.

An operator may set `TRUSTED_PROXIES` to a comma-separated allowlist of reviewed proxy addresses/subnets. Before doing so, inspect the complete API Gateway/Caddy/Nginx chain, ensure the backend cannot be reached through an untrusted path, and verify how each proxy overwrites/appends forwarding headers. Never use an indiscriminate trust-all configuration or assume that a fixed hop count is safe for different ingress paths. The sample local Compose configuration does not enable proxy trust automatically.

Before production rollout, verify representative client addresses and limits on each supported ingress path. Do not infer correct client-IP attribution from passing direct Express tests. Application rate limiting remains a fallback; configure reviewed API Gateway/edge limits separately.

## Verification boundaries

Security regressions use raw Supertest to prove missing/forged/cookie-only/cross-session tokens fail, valid token headers and multipart writes succeed, production cookie attributes are correct, and untrusted forwarded addresses cannot bypass the API limiter. Existing integration fixtures use a CSRF-aware test client so normal workflows still exercise the protection.

Attachment integration tests use simulated S3 storage. Browser tests run against disposable local containers; no production data or AWS writes are needed. CodeQL alert resolution must be confirmed on the PR/main scan; local tests alone do not close GitHub alerts.
