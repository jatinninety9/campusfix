# CampusFix: step-by-step development checkpoint guide

**Checkpoint date:** 28 October 2026
**Project location:** `C:\NIET\SEM 5\DevOps`
**Scope:** Local development completed so far, including role-specific interfaces, staff creation, and the authentication rate-limit fix.

**Visual revision, 29 October:** The current application uses orange-and-white workspaces with warm ivory backgrounds, Outfit headings, and DM Sans body text. Admins have a statistics-first dispatch view; staff have an assignment-stage workbench; students have an illustrated orange reporting banner. The setup and workflows below remain applicable.

## 1. Understand what we are building

CampusFix is a campus maintenance and complaint-management application for the DevOps assessment.

Students report problems such as broken projectors, Wi-Fi failures, faulty lights, or leaking taps. Administrators assign reports to maintenance staff. Staff record their work and resolve issues. The student who reported an issue can confirm the fix or reopen it.

The current implementation includes:

- Student registration and login for all three roles.
- Separate student, staff, and administrator workspaces.
- Database-backed statistics and category charts.
- Complaint creation, searching, and status filtering.
- Support for existing complaints using the thumbs-up button.
- Administrator-only staff account creation and assignment.
- Staff work updates and required resolution notes.
- Student confirmation and reopening of resolved reports.
- Responsive desktop, tablet, and mobile layouts.
- Backend integration tests and a real browser workflow test.

**Not yet implemented:** S3 photo attachments, QR reporting, frontend/backend Docker images, complete application Compose deployment, GitHub Actions CI/CD, and final AWS EC2 deployment. Docker currently runs PostgreSQL only. The application is running locally, not hosted on AWS.

## 2. Know the technology stack

| Layer                  | Current implementation                      | Purpose                                                |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------ |
| Frontend               | React + Vite                                | Pages, forms, navigation, and dashboard                |
| Styling                | Custom CSS with UI/UX Pro Max guidance      | Responsive layout and role-specific color palettes     |
| Icons and charts       | Lucide React + Recharts                     | Controls and database-backed visual summaries          |
| Backend                | JavaScript: Node.js + Express               | Authentication, authorization, and complaint APIs      |
| Validation             | Zod                                         | Validate request inputs                                |
| Database               | PostgreSQL 17                               | Persist users, sessions, issues, and complaint support |
| Local database runtime | Docker Compose                              | Start PostgreSQL with persistent storage               |
| Authentication         | Opaque session token in an HTTP-only cookie | Keep users signed in                                   |
| Password storage       | Salted scrypt hashes                        | Avoid storing plain-text passwords                     |
| Automated checks       | Node test runner + Supertest + Playwright   | Verify APIs and browser workflows                      |

The current application uses **custom CSS**, rather than Tailwind, and **cookie-based sessions**, rather than JWTs. These describe the code that was actually built.

## 3. Check your prerequisites

Open Docker Desktop and make sure its Linux container engine is running. Then open PowerShell:

```powershell
Set-Location 'C:\NIET\SEM 5\DevOps'
node --version
npm.cmd --version
docker version
docker compose version
```

Use Node.js 22.12+ or Node.js 24. This project was developed using Node.js 24. For the browser test, have Microsoft Edge installed; Chrome can be selected instead.

The commands below use `npm.cmd` so they also work when PowerShell blocks the `npm.ps1` wrapper.

## 4. Prepare local configuration

This has already been done on the current computer. On a fresh copy, create `.env` only if it does not exist:

```powershell
if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
}
```

The example contains these local development values:

```dotenv
DATABASE_URL=postgres://campusfix:campusfix_local@localhost:54329/campusfix
PORT=4000
NODE_ENV=development
SEED_PASSWORD=CampusFix@2026
```

These are local demonstration settings. `.env` is excluded by `.gitignore`. Do not put AWS credentials in the project or include them in assessment screenshots.

## 5. Install JavaScript dependencies

From the project root, run:

```powershell
npm.cmd ci
```

This installs the versions recorded in `package-lock.json` for both workspace packages: `client` and `server`. Dependencies are already installed on the current computer; reinstalling is normally unnecessary when simply reopening the project.

## 6. Start the PostgreSQL container

```powershell
docker compose up -d db --wait
docker compose ps
```

Expected result: the `db` service is running and healthy.

Configuration details:

- Container image: `postgres:17-alpine`.
- PostgreSQL listens inside the container on port `5432`.
- The computer connects through `127.0.0.1:54329`.
- Database name and username: `campusfix`.
- The named volume `campusfix_data` stores the database persistently; Compose normally prefixes the actual volume name with the project name.

You do not need a separate PostgreSQL installation on Windows.

## 7. Initialize the schema and sample accounts

```powershell
npm.cmd run db:init
```

This creates the tables if they are missing, creates sample accounts if they are missing, and adds sample complaints only when the issue table is empty.

| Table      | Stores                                                            |
| ---------- | ----------------------------------------------------------------- |
| `users`    | Names, unique emails, password hashes, and roles                  |
| `sessions` | Session-token hashes, user references, and expiry times           |
| `issues`   | Complaint details, status, assignment, and resolution information |
| `supports` | Which users support which complaints                              |

Seeding preserves existing accounts and reports. Changing `SEED_PASSWORD` and running this command again **does not reset existing passwords**.

## 8. Start the frontend and backend

```powershell
npm.cmd run dev
```

Keep this terminal open. It starts both development servers:

| Service             | Address                          |
| ------------------- | -------------------------------- |
| Frontend            | http://127.0.0.1:5173/           |
| API health endpoint | http://127.0.0.1:4000/api/health |

Use `127.0.0.1` consistently in the browser; switching between `localhost` and `127.0.0.1` uses different cookie hosts.

Vite forwards frontend requests under `/api` to the Express server. Express communicates with PostgreSQL. The health endpoint queries the database before returning an `ok` response.

To check the API from another PowerShell terminal:

```powershell
Invoke-RestMethod 'http://127.0.0.1:4000/api/health'
```

Expected fields: `status: ok` and `service: campusfix-api`.

## 9. Sign in using the demonstration accounts

| Role    | Email                     | Initial local password |
| ------- | ------------------------- | ---------------------- |
| Student | `student@campusfix.local` | `CampusFix@2026`       |
| Staff   | `staff@campusfix.local`   | `CampusFix@2026`       |
| Admin   | `admin@campusfix.local`   | `CampusFix@2026`       |

The password above is the example used for the original seeded local accounts. Accounts created later use the password entered during creation.

Logout is the arrow-out icon next to the account area at the bottom of the desktop sidebar. On mobile, it is at the top-right beside the brand. The compact tablet sidebar also includes the sign-out icon.

## 10. Use the student workspace

The student interface uses an orange reporting banner, white panels, and warm ivory backgrounds.

1. Sign in as the sample student, or select **Create account** to register a new student.
2. Review the overview. Statistics and the category chart summarize that student's own reports.
3. Select **Report an issue**.
4. Enter a title, category, priority, location, and description.
5. Select **Submit report**.
6. Open **My reports** to track the complaint.
7. Open **All issues** to browse shared campus reports. Use search or status filters to narrow the list.
8. Click the thumbs-up button to support an existing complaint. Click again to remove your support.
9. Open a complaint by clicking its title or its view arrow.

Public registration always creates a **student** account. It cannot grant staff or administrator access.

Example report:

| Field       | Example                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Title       | Projector not working in Room 204                                                                        |
| Category    | IT & Network                                                                                             |
| Priority    | High                                                                                                     |
| Location    | Academic Block A, Room 204                                                                               |
| Description | The projector powers on but does not display the connected laptop. It affects the scheduled lab session. |

Photo uploads are a later checkpoint; there is no attachment control yet.

## 11. Create a staff account as an administrator

The admin interface uses white panels, orange actions, and a charcoal dispatch band.

1. Sign out of the student account.
2. Sign in as `admin@campusfix.local`.
3. Open **Manage staff** in the sidebar, or use the dashboard action.
4. Enter the staff member's full name and unique email address.
5. Enter an initial password of 10–128 characters.
6. Select **Create staff account**.
7. Confirm the success message and the new entry in the maintenance team directory.

The new staff member can sign in immediately. No invitation email is sent, so share the initial password privately. A password-reset or forced-first-login-change flow has not yet been implemented.

The directory shows each member's number of active assignments. Student and staff accounts cannot create staff members; the API enforces this as well as the interface.

## 12. Assign a complaint as an administrator

1. Open **Control center** to see campus-wide metrics and reports awaiting an owner.
2. Open an unassigned complaint from the dispatch panel or **All issues**.
3. Under **Assign maintenance staff**, select the intended staff member.
4. Select **Assign**.
5. Reopen the complaint to confirm the assigned name, if needed.

Assignment and status are separate: assigning staff does not automatically mark work as started.

## 13. Work on a complaint as staff

The staff interface uses an orange-edged white workbench with assignment-stage cards. Select a stage card to open assignments filtered by that status.

1. Sign out of the admin account.
2. Sign in as the assigned staff member.
3. Open **My workbench** to review personal workload and urgent assignments.
4. Open **My assignments**.
5. Select the assigned complaint.
6. Select **Start work**. Its status changes to **In progress**.
7. Open the complaint again when the work is complete.
8. Enter resolution notes explaining the repair and verification. Notes require at least 10 characters.
9. Select **Mark resolved**.

Staff can start or resolve only complaints assigned to them. Their overview metrics and chart summarize their own assignments. **All issues** remains a shared campus view.

## 14. Confirm or reopen the repair as the reporting student

1. Sign back in as the student who originally submitted the complaint.
2. Open **My reports**, or the overview's resolution-review panel.
3. Open the resolved complaint and read its notes.
4. Select **Confirm fix** if the issue is fixed. Its status becomes **Closed**.
5. Select **Reopen issue** if the problem remains. Its status returns to **Open**, while the staff assignment is retained.

Reopening clears the previous resolution notes and resolution timestamp so the next repair can be recorded separately. Only the reporting student can perform the student confirmation/reopen action.

Typical status flow:

```text
Open -> In progress -> Resolved -> Closed
                          |
                          +-> Open, if the reporter reopens it
```

## 15. Understand the dashboard figures

- **Admin:** statistics and category counts cover all campus reports.
- **Student:** statistics and category counts cover reports created by that student; the campus feed remains shared.
- **Staff:** statistics, category counts, and the initial assignment queue cover that staff member's assignments.
- **Open & in progress:** reports whose status is neither resolved nor closed.
- **Resolved & closed:** reports in either of those two states.
- **Overdue:** active reports past the default three-day target.
- **Average resolution time:** creation to the recorded resolution, using the latest resolution after reopening.

Counts are calculated from PostgreSQL-backed API records. The initial sample complaints are demonstration data, not a connection to a live college system.

## 16. Run the automated checks

Keep PostgreSQL running. In another terminal at the project root:

```powershell
npm.cmd test
```

The latest completed run passed **11 tests**, including the parent workflow test. It covers authentication, validation, role restrictions, staff creation/login, complaint persistence, support toggling, assignment, resolution, confirmation/reopening, cross-origin write protection, logout, and rate-limit behavior.

Build the frontend:

```powershell
npm.cmd run build
```

Expected result: a successful Vite build under `client/dist`. This creates frontend assets; it does not deploy or start a production application.

With **both development servers also running**, run the browser check:

```powershell
npm.cmd run test:browser
```

The browser check uses headless Microsoft Edge and exercises registration, role-specific workspaces, staff creation/login, report creation, assignment, resolution, and confirmation. It checks responsive layouts and keyboard dismissal of complaint details. Test accounts and reports created by the script are removed afterward; it does not delete user-created complaints.

For installed Chrome instead:

```powershell
$env:BROWSER_CHANNEL = 'chrome'
npm.cmd run test:browser
Remove-Item Env:BROWSER_CHANNEL
```

To format the code when making future changes:

```powershell
npm.cmd run format
```

## 17. Review the authentication fix

The original limiter was attached to all authentication routes. Successful sign-ins, sign-outs, and session checks shared one allowance, which caused the visible **Too many attempts** message during normal testing.

The fix now applies:

- A login limiter of 40 failed requests per 15-minute window, keyed by client IP. Successful login responses are excluded.
- A separate registration limiter of 20 requests per 15-minute window.
- No login limiter on session checks or logout.

The regression test performs more than 40 session checks and successful logins, then confirms that repeated incorrect logins still receive HTTP 429. It also checks that session access and logout remain available while login is limited.

These limits currently use process memory. Production rate-limit storage and proxy configuration must be reviewed during deployment.

## 18. Understand the source layout

```text
DevOps/
  client/
    src/
      main.jsx           Login, complaint forms, details, and application shell
      RoleWorkspace.jsx  Role-specific overview panels and wording
      StaffManager.jsx   Administrator staff creation and directory
      CategoryChart.jsx  Lazy-loaded category chart
      styles.css         Responsive styling and role palettes
    vite.config.js       React tooling and development API proxy
  server/
    src/
      app.js             Express routes, validation, sessions, and permissions
      db.js              PostgreSQL connection and schema initialization
      password.js        Password hashing and verification
      seed.js            Local accounts and sample data
      index.js           API startup and shutdown
    test/
      workflow.test.js   Database-backed regression tests
  scripts/
    browser-smoke.js     Browser verification and screenshots
  design-system/
    campusfix/           UI/UX guidance and dashboard overrides
  output/previews/       Captured interface screenshots
  compose.yaml           PostgreSQL service and persistent volume
  .env.example           Local configuration template
  package.json           Workspace commands
  package-lock.json      Locked dependency versions
```

## 19. Stop and restart safely

To stop the development servers, press **Ctrl+C** in the terminal running `npm.cmd run dev`.

To stop the database while retaining its records:

```powershell
docker compose stop db
```

For later sessions:

```powershell
Set-Location 'C:\NIET\SEM 5\DevOps'
docker compose up -d db --wait
npm.cmd run dev
```

You do not need to reinstall packages or seed again for each session. Avoid `docker compose down -v` unless you explicitly intend to delete the local database volume and its records.

## 20. Troubleshoot common local problems

| Symptom                             | Action                                                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm.ps1` execution-policy error    | Use `npm.cmd` as shown in this guide.                                                                                           |
| Docker engine connection error      | Open Docker Desktop, wait for the Linux engine, then run `docker version`.                                                      |
| Database connection failure         | Run `docker compose ps` and `docker compose logs --tail 50 db`; confirm `.env` uses host port `54329`.                          |
| Login says incorrect email/password | Check the intended role's email and original seed password. Reseeding does not reset passwords.                                 |
| New staff member cannot sign in     | Use the exact email and initial password entered by the admin. Check whether account creation succeeded.                        |
| Too many failed sign-in attempts    | Wait for the remaining rate-limit window, up to 15 minutes. Normal session checks and successful logins no longer cause this.   |
| UI cannot reach CampusFix           | Confirm the development terminal is running, then check the API health endpoint.                                                |
| Frontend starts on a different port | Another process may be using `5173`; use Vite's printed URL. The browser test expects `5173`, so free that port before testing. |
| Staff cannot start work             | Confirm the administrator assigned the report to that specific staff account.                                                   |
| Mark resolved button is disabled    | Enter resolution notes with at least 10 non-padding characters.                                                                 |
| Student cannot confirm a fix        | Use the original reporter's account and ensure the issue is in Resolved status.                                                 |

## 21. Record the current assessment checkpoint

Useful screenshots or demonstrations to save:

1. Login and student registration pages.
2. Student dashboard and a submitted complaint.
3. Admin control center and staff creation page.
4. A complaint assigned to a staff member.
5. Staff workbench, in-progress status, and resolution notes.
6. Student confirmation and the final Closed status.
7. Passing API tests and frontend build output.
8. Healthy PostgreSQL container and successful API health response.

Automated preview files are saved in `output/previews/`, including desktop/mobile dashboards, the admin team page, staff dashboard, and login page. Browser-test screenshots can show temporary test records that are removed after the run.

## 22. Keep the DevOps completion claims precise

| Requirement                                      | Current checkpoint                                                                                                |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Functional application with login and dashboards | Implemented and locally tested                                                                                    |
| JavaScript backend                               | Implemented with Node.js/Express                                                                                  |
| PostgreSQL database                              | Running locally in Docker with persistent storage                                                                 |
| Role-specific interface and admin staff creation | Implemented and locally tested                                                                                    |
| AWS authentication                               | The `campusfix` profile previously authenticated as `campusfix-developer`; refresh verification before cloud work |
| AWS EC2/S3 access                                | Basic read checks previously succeeded; provisioning permissions are not established by those checks              |
| Frontend/backend Docker images                   | Pending                                                                                                           |
| Complete multi-service application Compose setup | Pending; current Compose file runs only PostgreSQL                                                                |
| GitHub repository, branches, and pull requests   | Project publication and workflow evidence pending                                                                 |
| GitHub Actions CI/CD                             | Pending                                                                                                           |
| S3 attachments and application IAM role          | Pending                                                                                                           |
| Final EC2 deployment                             | Pending                                                                                                           |

AWS identity can be rechecked without displaying credentials:

```powershell
aws sts get-caller-identity --profile campusfix
```

AWS is not required to run this development checkpoint. No cloud resources were created during the local implementation described here.

The planned JavaScript S3 integration will support Practical 3, but it does not satisfy Practical 4's specific Python/boto3 requirement. Final practical coverage should be recorded after each corresponding feature is implemented and verified.
