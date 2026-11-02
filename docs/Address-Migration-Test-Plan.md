# Address migration release gate

The current address stays in service until the replacement passes every required
check. This change adds tests; it does not create API Gateway, change DNS, change
Caddy, or deploy anything to EC2. A failing endpoint is investigated and fixed;
it is not deleted merely because a check failed.

## Automated local and CI coverage

Run from Windows PowerShell in `C:\NIET\SEM 5\DevOps`:

```powershell
docker compose up -d db --wait
npm.cmd test
npm.cmd run build
docker compose up -d --build --wait
$env:BASE_URL = 'http://127.0.0.1:8095'
npm.cmd run test:deployment
npm.cmd run test:browser
Remove-Item Env:BASE_URL
```

`npm test` uses the database configured by `.env`. Use the local development
database, not the EC2 production database. Tests create uniquely named users and
reports, then remove those fixtures. Attachment integration tests use simulated
storage, not real S3. The production contract suite checks secure cookies using
explicit Cookie headers; actual browser HTTPS behavior needs the live checks below.

| Area | Required result |
| --- | --- |
| Authentication | Register/login/me/logout work; expired, forged, and logged-out tokens fail |
| Cookies | Production login/logout retain Secure, HttpOnly, SameSite=Lax, Path=/; no fixed Domain |
| Origin checks | Matching public Host/Origin accepted; foreign, malformed, null origins rejected |
| Proxy headers | Untrusted forwarded-host headers cannot bypass origin checks |
| Roles | Students cannot provision staff or assign/resolve; assigned staff can work; admins can assign |
| Lifecycle | Create, list, support/unsupport, assign, start, resolve, reopen, confirm |
| Input errors | Invalid JSON/IDs return 400; oversized JSON returns 413; missing resources return 404 |
| Routing | Authenticated unknown API paths and unsupported methods return JSON 404, not SPA HTML |
| Attachments | Permissions, content detection, size/count limits, concurrent uploads, signed links, deletion |
| Storage failures | Failed uploads do not create records; failed deletions preserve records; missing storage is explicit |
| Assets/browser | HTML, entry assets and generated JS/CSS chunks load; browser workflow has no unexpected failed requests |

CI automatically includes `deployment.test.js` through the existing `test/*.test.js`
glob and runs `test:deployment` against Docker/Nginx. CI is only verified after the
changed files are pushed and the workflow passes.

## Read-only check on either public address

This command does not use credentials, create users/reports, or write to S3:

```powershell
$env:BASE_URL = 'https://campusfix.13-233-17-151.sslip.io'
npm.cmd run test:deployment
Remove-Item Env:BASE_URL
```

Repeat with the actual replacement HTTPS origin after it exists. Do not disable
TLS certificate verification to make a check pass. The script requires a root URL
and rejects redirects: use the final HTTPS address, without a stage path.

## Required replacement-address checks before cutover

1. Establish the original address baseline and record failures before migration.
2. Validate the gateway configuration, TLS, route forwarding, public Host/Origin
   handling, and cookie forwarding. Do not blindly trust client-supplied headers.
3. Sign in separately as student, staff and admin in a real browser on the new
   origin. Reload and verify the session persists. Logout must invalidate it.
4. Use a clearly named migration test report: create, support, assign, resolve,
   reopen and confirm. Check unauthorised roles still receive 403.
5. Upload/view/delete actual JPEG, PNG and WebP files through the new gateway.
   Test a valid image at 5 MiB and reject one above 5 MiB. Check multipart bytes,
   gateway limits, signed-link expiry, and the existing S3 bucket policy.
6. Verify all frontend assets and API requests in the browser Network panel;
   run the read-only smoke check. No unexplained 4xx/5xx, failed requests,
   mixed-content errors, redirect loops, or old-domain dependencies may remain.
7. Confirm pre-existing users/reports/attachments are still present. Verify SSH,
   pgAdmin tunnel and S3 access independently; these use separate connections.
8. Save the current proxy configuration for rollback. Switch only after the
   above evidence passes. Remove the old hostname configuration last, rerun
   checks, and retain the saved configuration until the new deployment is stable.

The existing browser workflow depends on seeded local accounts and direct local
database cleanup. Do not point it at production. Production role/attachment tests
above are a separate controlled check; the read-only script is safe for either URL.
