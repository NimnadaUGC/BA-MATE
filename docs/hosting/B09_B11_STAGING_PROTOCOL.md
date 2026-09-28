# B09–B11 hosted staging protocol

Run this only after the research protocol/ethics materials approve the consent, retention and withdrawal wording. Use synthetic `@example.invalid` accounts and fictional feedback only. Do not use a volunteer's identity, BA project, source, prompt, document, model response or API key.

## Before the test

1. Create the separate HTTPS subdomain with document root `research-service/public/`.
2. Store `private/config.php` outside that public root. Use a dedicated least-privilege MySQL user and a host-approved recovery-mail sender.
3. Apply `research-service/schema.sql`; run `php scripts/bootstrap_researcher.php /private/config.php researcher-staging@example.invalid` only from the server shell.
4. Configure the daily `maintenance.php` cron job and an encrypted, access-restricted off-host backup destination.
5. Build a staging desktop package with `VITE_BA_MATE_RESEARCH_URL` set to the exact HTTPS origin. Record the actual renderer origin in `allowed_origins`; do not use `*`.

Record only route/status/header outcomes, timestamps, software versions and anonymised test codes. Never record passwords, raw session/invitation/recovery tokens, database credentials or email contents.

## Staging evidence table

| Test | Procedure | Pass evidence |
|---|---|---|
| Public boundary | Request `/api/v1/health`; request a public config/schema path; check HTTPS redirect and response headers. | Health succeeds over HTTPS. Config/schema are inaccessible. `no-store`, CSP, `nosniff`, referrer and exact CORS headers are present. |
| Account lifecycle | Create a synthetic invitation; register; sign in; sign out; recover; reset; try the old token/password. | Invitation and recovery tokens work once only. Old session/password fail after reset/logout. |
| Expiry and rate limit | Let or set a synthetic invite/recovery token to expire; make nine failed sign-ins for one synthetic account. | Expired tokens fail; ninth failed sign-in is rate-limited; a valid sign-in from a different synthetic account remains available. |
| Consent and queue | Sign in as a synthetic participant. Verify no upload before consent; record versioned consent; queue and sync one permitted configured-run event; resend its batch. | No-consent upload fails. Accepted batch has only pseudonym, condition, required manifest and permitted measurements. Retry returns duplicate acknowledgement without another record. |
| Privacy boundary | Attempt a synthetic payload containing project/source/prompt/response/filename/credential field names. | Server rejects it. Researcher export contains no account email or desktop project content. |
| Role and isolation | Create a second synthetic participant. Attempt researcher endpoints and upload under the first pseudonym. | Participant administration request and cross-pseudonym upload both fail. |
| Withdrawal/revocation | Withdraw synthetic consent; attempt upload. Re-consent only if the approved protocol permits it. Revoke a synthetic account; retry existing session. | Withdrawal prevents collection and marks unreviewed feedback for review. Revocation invalidates active sessions without affecting local desktop work. |
| Separate feedback/quality | Submit harmless synthetic feedback and review it. Record an independent quality score/correction minutes for an accepted synthetic run. | Feedback is absent from ordinary export. Quality assessment is researcher-only and appears in its separate export collection. |
| Backup/restore | Take encrypted backup; restore it to a separate isolated database; compare pseudonymous event, consent and assessment counts; destroy test restore. | Restored records retain consent version, manifest and assessment provenance. No backup is public. |
| Offline/reconnect | Disconnect staging desktop after active session, queue a permitted batch before grace expiry, reconnect and sync. Repeat after the recorded grace time using a shortened staging configuration if needed. | Local BA work remains usable throughout. Pre-expiry queue syncs after reconnect; post-expiry collection stops until re-authentication. |

## Completion record

Attach the redacted results to `B09_B11_IMPLEMENTATION_VERIFICATION_2026_09_21.md`, update H01–H11 in `SHARED_HOSTING_PLAN.md`, and obtain researcher/supervisor sign-off before inviting a real participant. Do not mark B09–B11 beta-ready based on local tests alone.
