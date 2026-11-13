# Contributing to CampusFix

Bug fixes, tests, accessibility improvements and documentation are welcome. Discuss substantial features in an issue first. Search existing issues and PRs to avoid duplicate work.

## Local setup

Fork the repository, clone your fork and follow the [README setup](README.md#run-locally). Use Node.js 24, a local PostgreSQL database and disposable accounts. You do not need production AWS, database, SSH or deployment credentials.

In an existing clone of your fork, add upstream once and create a branch:

```powershell
git remote add upstream https://github.com/jatinninety9/campusfix.git
git fetch upstream
git switch -c fix/describe-the-change upstream/main
```

Use `feature/`, `fix/` or `docs/` and a meaningful name. Commit only related files; avoid unrelated formatting or changes to other people's work.

## Checks and pull requests

1. Run `git diff --check`, `npm.cmd run build` and relevant existing tests. Linux/macOS use `npm`; see [verification](README.md#verification) for database/browser prerequisites.
2. Add a meaningful regression test when fixing recurring behavior. Documentation-only changes do not need new application tests.
3. Describe the checks actually run and anything not tested. A skipped or unapproved CI run is not a pass.
4. Review the staged file list. Do not commit secrets, dumps, real user data or unreviewed screenshots.

Stage intentional paths, commit and push to your fork:

```powershell
git add path/to/changed-file
git diff --cached --check
git commit -m "Describe the change"
git push -u origin fix/describe-the-change
```

Open a PR against `jatinninety9/campusfix:main`. Explain the problem, resulting behavior, validation and any migration/configuration impact. Use synthetic local data in visual screenshots. Keep PRs small enough to review.

## CI and production boundaries

- Fork PR checks may require maintainer approval. Deployment is expected to be skipped on PRs.
- Never expose credentials or use privileged workflow triggers to execute untrusted PR code.
- Workflow, migration, dependency, Dockerfile and deployment changes require careful review. Explain compatibility with existing data and the previous application version.
- Do not run fixture tests, load tests, scans or cleanup against the maintained live deployment without explicit authorization.
- Do not run production `docker compose down --volumes` or `git clean` as a troubleshooting step.

## Issues, conduct and licensing

For ordinary bugs, provide a minimal local reproduction, expected/actual behavior and relevant versions. Redact logs and screenshots. Follow [SECURITY.md](SECURITY.md) for vulnerabilities; do not disclose them publicly.

Treat contributors respectfully and focus review on the work. Do not post harassment, private information or credentials. Maintainers may remove abusive content and decline out-of-scope contributions.

By submitting a contribution, you agree that your original contribution is provided under the repository's MIT License. Identify third-party material and preserve its required notices. A submission does not guarantee acceptance.
