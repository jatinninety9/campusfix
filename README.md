# CampusFix

A campus maintenance platform built for a DevOps lab assessment. Students report problems, staff resolve them, and administrators coordinate assignments. The backend uses JavaScript (Node.js + Express) and PostgreSQL. The responsive React dashboard uses real API records.

## Current development — local application

Implemented: student registration, cookie-based sessions, password hashing, role-based authorization, complaint creation/search/filtering, duplicate support, staff assignment, resolution notes, student verification/reopening, and database-backed dashboard counts and category chart. The 29 October visual revision uses orange, white, and warm ivory, with Outfit headings and DM Sans body text. Admins have statistics-first dispatch and a Manage staff page; staff have a workbench with assignment-stage filters; students have an illustrated reporting overview and fixes awaiting confirmation. Login, forms, dialogs, and charts share the light theme.

Admins can create staff accounts from **Manage staff**, using a name, unique email, and initial password (10–128 characters). New staff can sign in immediately and appear in the assignment list. Staff directory cards show current active assignment counts. No invitation email or password-reset flow is implemented yet; initial passwords must be shared privately. Only admins can create staff accounts; public registration always creates students.

This checkpoint uses **sample campus complaints** and local accounts. It does not provision AWS resources. S3 attachments, QR reporting, complete application containerisation, CI/CD, and EC2 deployment remain later checkpoints. Docker Compose currently runs the database only.

## Run locally

Requirements: Node.js 22.12+ (24 supported), npm, and Docker Desktop with Linux containers.

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d db --wait
npm run db:init
npm run dev
```

Open http://localhost:5173. API: http://localhost:4000/api/health. The database is bound to localhost:54329 and persists in a Docker volume. The frontend proxies `/api` to Express, so browser requests use a single origin.

### Local demonstration accounts

| Role    | Email                   |
| ------- | ----------------------- |
| Student | student@campusfix.local |
| Staff   | staff@campusfix.local   |
| Admin   | admin@campusfix.local   |

Password for newly seeded accounts: the `SEED_PASSWORD` in your local `.env` (example: `CampusFix@2026`). These are local demonstration credentials and must not be deployed publicly. Seeding preserves existing users and issues; changing `SEED_PASSWORD` does not reset existing passwords. Public registration always creates a student, regardless of request fields.

### Verification

```powershell
npm test
npm run build
```

With both development servers running, run `npm run test:browser` for the real browser workflow. It uses installed Microsoft Edge by default; set `BROWSER_CHANNEL=chrome` to use installed Chrome. Desktop and mobile screenshots are saved in `output/previews/`. Browser-created test accounts and reports are removed after the run.

Verified for the current revision: the PostgreSQL integration suite passes (11 tests), the production frontend builds, and the real browser workflow passes at desktop/tablet/mobile sizes with no page runtime errors. This includes admin-only staff creation, new-staff login, and a regression check for login rate limiting. Successful logins, logout, and session checks do not consume the failed-login allowance; registration has a separate limiter. AWS deployment and S3 integration have not been exercised by these checks.

The test suite requires the local database and creates uniquely named test users. It deletes its own records after completing. Tests cover the real PostgreSQL complaint lifecycle, privilege escalation, authorization boundaries, input validation, support toggling, cross-origin writes, and session invalidation.

### Scope and behavior

- All signed-in campus users can view complaint titles, descriptions, locations, and reporter names. Do not include sensitive personal details in reports. Students can support reports; only a report's owner can confirm/reopen its resolved status.
- Admins assign staff. Staff may start or resolve only issues assigned to them. Resolution requires notes. The default resolution target is three days from creation.
- Sessions expire after seven days. Only session-token hashes are stored in PostgreSQL. Cookies are HTTP-only and SameSite=Lax; production cookies require HTTPS.
- Admin dashboard figures summarize all campus reports; student and staff figures summarize their own reports or assigned work. The student campus feed and All issues view remain shared. Resolution time measures creation to the latest resolution following any reopening.
- Web fonts load from Google Fonts, with local sans-serif fallbacks. Charts do not animate; reduced-motion preferences are respected.
- Development servers bind to loopback. Do not expose the development server as a production deployment.

## Planned DevOps evidence

Linux/EC2/SSH (1–2), S3/IAM (3), Git/GitHub branches and pull requests (6–7), Docker images (11), GitHub Actions (13), multi-service Compose (14), and integrated deployment pipeline (15). The JavaScript S3 integration does not claim the Python/boto3 practical (4).

See [the development checkpoint guide](docs/CampusFix-Development-Checkpoint-Guide.md) for setup, role workflows, tests, troubleshooting, and the boundary between completed local work and pending DevOps deployment.
