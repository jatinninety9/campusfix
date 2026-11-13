# Security policy

## Reporting a vulnerability

Do not put credentials, production data, exploit payloads containing personal data, or live exploit instructions in a public issue or pull request.

Use this repository's **Security → Advisories → Report a vulnerability** option when it is enabled. If that option is unavailable, do not disclose the vulnerability publicly; the maintainer must first enable private vulnerability reporting or publish a private contact method. This repository's reporting configuration is still being prepared.

Include the affected commit/version, expected versus observed behavior, minimal reproduction in a local disposable environment, impact, and a proposed mitigation when available. Do not include real user data. No response-time or bounty commitment is offered.

## Testing boundaries

Run tests against your own local instance with disposable data and test credentials. Public availability of the source or website does not authorize testing the maintainer's production infrastructure. Obtain explicit permission before testing the live application, AWS resources, load limits, or security controls.

## Configuration and deployment

- `.env.example` and Compose defaults are local demonstration values, not production credentials. Generate independent production passwords; never reuse sample/test passwords.
- Do not commit `.env`, AWS credentials, SSH keys, database dumps, session cookies or screenshots containing personal data.
- Public registration creates students. Current report and photo visibility is shared among authenticated users; this application is not a confidential-complaint system.
- Production secrets and IAM roles belong to the deployment operator. Contributors do not need access to them.
- Pull-request verification uses disposable local resources. Production deployment is restricted to successful verification for pushes to the upstream `main` branch and the separately configured AWS OIDC trust policy.
- A merged change can run on the production host. Review workflow, deployment, dependency, Dockerfile and application changes before merging.
- CODEOWNERS is review routing, not access enforcement. Required reviews and checks must be configured in GitHub branch protection/rulesets.
- Recovery artifacts currently remain on the EC2 host. Automated rollback and off-host disaster recovery have not been verified.

## Support scope

This is an assessment project under active development. No production-security certification, penetration-test coverage, availability SLA, or supported concurrency limit is claimed. Security fixes target the current main branch; there is no maintained release support matrix yet.
