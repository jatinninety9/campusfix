# Role login and deployment checkpoint

Student, Staff and Admin have explicit sign-in portals. Only students can register publicly. The server checks the selected portal against the stored account role before creating a session. Existing clients without a portal field continue to work; they receive only their stored role's permissions.

Keep the existing administrator account. Create `admin@campusfix.com` as a separate administrator with its own password. Do not change existing users or passwords as part of this historical provisioning procedure. Suggested staff identifiers: `firstname.staff@campusfix.com` (add a surname when necessary); students keep their existing college email addresses. The domain format grants no privileges, and these identifiers are not provisioned mailboxes.

## Publish first

From Windows PowerShell in the project directory, review `git diff --check` and `git status --short`, create a feature branch, commit the application and test changes, push, and open a pull request. Wait for all CI checks before merging. Then pull main locally. CI verifies the build and containers, backend permission boundaries, the browser lifecycle, assets/API routing, portal selection, production labels and refresh regressions.

## Update EC2 after the PR is merged

In the existing EC2 SSH session:

```bash
cd /home/ubuntu/campusfix
git status --short --branch
git pull --ff-only origin main
sudo docker compose -f compose.ec2.yaml -f compose.https.yaml -f compose.pgadmin.yaml -f compose.gateway.yaml up -d --build --wait api web
sudo docker compose -f compose.ec2.yaml -f compose.https.yaml -f compose.pgadmin.yaml -f compose.gateway.yaml ps
curl --fail --show-error http://127.0.0.1:8095/api/health
```

These four Compose files must already exist on EC2. Keep the existing EC2-specific Compose files, `.env`, Caddy settings and volumes. Do not run `down --volumes`. This rebuilds the application services; PostgreSQL data and S3 objects stay in their current storage. The update can briefly interrupt requests while services restart.

## Create the second administrator after updating the API container

Run in EC2 Bash, not Windows PowerShell. The password prompt does not echo input. The script refuses to overwrite an existing email or change its role/password.

```bash
cd /home/ubuntu/campusfix
export CAMPUSFIX_ACCOUNT_NAME='Campus Administrator'
export CAMPUSFIX_ACCOUNT_EMAIL='admin@campusfix.com'
export CAMPUSFIX_ACCOUNT_ROLE='admin'
read -r -s -p 'Choose a new administrator password (12–128 characters): ' CAMPUSFIX_ACCOUNT_PASSWORD
printf '\n'
export CAMPUSFIX_ACCOUNT_PASSWORD
python3 -c 'import json,os; print(json.dumps({key:os.environ["CAMPUSFIX_ACCOUNT_"+key.upper()] for key in ("name","email","password","role")}))' | sudo docker compose -f compose.ec2.yaml exec -T api node server/src/create-account.js
unset CAMPUSFIX_ACCOUNT_NAME CAMPUSFIX_ACCOUNT_EMAIL CAMPUSFIX_ACCOUNT_ROLE CAMPUSFIX_ACCOUNT_PASSWORD
```

New staff can still be added through the existing admin staff-management screen; select the Staff portal when signing in. Existing staff addresses remain valid.

## Verify both addresses from Windows PowerShell

```powershell
$env:BASE_URL = 'https://5660a4uet5.execute-api.ap-south-1.amazonaws.com'
npm.cmd run test:deployment
$env:BASE_URL = 'https://campusfix.13-233-17-151.sslip.io'
npm.cmd run test:deployment
Remove-Item Env:BASE_URL -ErrorAction SilentlyContinue
```

Manually sign in using each portal, confirm the expected dashboard, and verify both administrator accounts. Do not run the local database-cleaning browser smoke script against production. The `test:ui` script uses mocked API responses and does not verify live account authentication; `test:deployment` is read-only.

After this checkpoint succeeds, configure automated CD to deploy only a revision that has passed CI. The current CI workflow does not yet deploy to EC2.
