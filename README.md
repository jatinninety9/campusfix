# CampusFix

A campus maintenance application built for a DevOps assessment. Students report issues, administrators assign staff, and assigned staff resolve reports with notes. Reporters can confirm a fix or reopen an issue.

## Features and technology

- Separate Student, Staff and Admin portals with server-side role and ownership checks.
- Student registration, cookie sessions, password hashing and logout.
- Categories, priorities, locations, search, filters, support votes and role-specific dashboards.
- Administrator staff provisioning and assignment, staff resolution and reporter confirmation.
- Optional private S3 photos: JPEG, PNG or WebP, up to three per issue and 5 MiB each, with short-lived viewing links.
- PostgreSQL migrations, Docker images, multi-service Compose and automated CI/CD.

| Layer | Tools |
| --- | --- |
| Frontend | React, Vite, JavaScript, CSS, Lucide icons, Recharts |
| Backend | Node.js 24, Express, Zod |
| Data | PostgreSQL 17, optional Amazon S3 |
| Verification | Node test runner, Supertest, Playwright |
| Delivery | Docker Compose, GitHub Actions, AWS OIDC/STS and SSM |

The maintained deployment runs on AWS EC2 with PostgreSQL on the instance and photos in S3. Contributors can run locally without AWS credentials. Production configuration is operator-managed and is not distributed with the local Compose setup.

## Run locally

Install Node.js 24, npm, Git and Docker with Linux containers. Start Docker Desktop before using Compose on Windows.

These commands use Windows PowerShell. On Linux/macOS, use `cp .env.example .env` and `npm` instead of `Copy-Item` and `npm.cmd`.

```powershell
git clone https://github.com/jatinninety9/campusfix.git
cd campusfix
Copy-Item .env.example .env
npm.cmd ci
docker compose up -d db --wait
npm.cmd run db:init
npm.cmd run dev
```

Copy the example only in a new checkout; do not overwrite an existing `.env`. The development website is http://localhost:5173. API health is http://localhost:4000/api/health. PostgreSQL binds to localhost port 54329 and persists in a Docker volume. Vite proxies `/api` to Express.

### Local demonstration accounts

| Portal | Email |
| --- | --- |
| Student | `student@campusfix.local` |
| Staff | `staff@campusfix.local` |
| Admin | `admin@campusfix.local` |

Their initial password comes from `SEED_PASSWORD` in your local `.env`. These are disposable demonstration accounts, not production credentials. Seeding preserves existing users; changing the environment value does not reset their passwords. Public registration always creates a student.

### Containerized application

After preparing `.env`, installing dependencies and seeding as above, stop the development process if running and start the complete local stack:

```powershell
docker compose up -d --build --wait
```

Open http://127.0.0.1:8095. Compose runs PostgreSQL, the API and Nginx/frontend. This is a local development configuration, not an internet-facing production template.

S3 is optional and is not configured by `.env.example`. Photo operations require a separately configured test bucket, region and credentials available to the API process. Do not use the maintained deployment's bucket or credentials for contributor testing.

## Verification

Use a disposable local database. Backend and browser suites create and delete their own test records. Start the local database and seed demo accounts as above, then run:

```powershell
npm.cmd run build
npm.cmd test
npx.cmd playwright install chromium
docker compose up -d --build --wait
$env:BROWSER_CHANNEL = 'chromium'
$env:BASE_URL = 'http://127.0.0.1:8095'
npm.cmd run test:deployment
npm.cmd run test:browser
npm.cmd run test:ui
Remove-Item Env:BASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:BROWSER_CHANNEL -ErrorAction SilentlyContinue
```

On Linux, Playwright may need `npx playwright install --with-deps chromium`; use `export`/`unset` for the environment variables.

- Backend tests cover authentication, permissions, complaint lifecycle, validation, migrations and attachment APIs with simulated storage.
- Browser tests exercise role workflows, keyboard behavior and responsive layouts.
- UI regressions use controlled API responses for refresh and presentation behavior.
- `test:deployment` is a read-only check of a running website's HTML, assets, database health and protected API routing. It does not deploy the application or establish load capacity.
- CI uses simulated storage for attachment tests and does not require AWS credentials for PR verification.

## Contributions and deployment

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR and [SECURITY.md](SECURITY.md) for private vulnerability reporting and testing boundaries.

API clients must follow the [CSRF handshake and rate-limit contract](docs/API-Security.md). State-changing requests require an explicit token header, including login and photo uploads.

PR checks use disposable resources. The upstream deployment job runs only after verification succeeds for a push to upstream `main`; fork deployments are skipped. Deployment uses short-lived OIDC credentials. Contributors do not need production access. Merged main changes can trigger deployment, so maintainers must review code, workflow and dependency changes before merging.

## Current limitations

- Signed-in users share report and photo visibility. Do not use the application for confidential or sensitive personal complaints.
- Email/campus membership verification, invitations, password-reset UI and MFA are not implemented.
- Application and database share one EC2 failure domain. Saved deployment backups/images are local recovery artifacts; automatic rollback and off-instance restoration have not been verified.
- No penetration-test certification, uptime SLA or measured concurrency limit is claimed.
- Earlier `docs/` files describe historical checkpoints; this README summarizes the current setup and scope.

## License

CampusFix is licensed under the [MIT License](LICENSE). Third-party dependencies, fonts and assets remain subject to their respective licenses.
