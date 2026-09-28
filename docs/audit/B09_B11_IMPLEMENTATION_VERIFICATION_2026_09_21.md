# B09–B11 implementation and verification record

Date: 2026-09-21  
Scope: local implementation and disposable MySQL integration test. This is **not** evidence that the hosted beta service is ready for participants.

## Delivered boundary

- The desktop uploader builds a new, pseudonymous allowlisted record. It cannot serialise workspace/project identifiers, titles, documents, sources, filenames, prompts, model responses, credentials, companies or content hashes.
- Collection requires explicit, versioned consent. Local BA work, project backups and approval identity remain independent of account/connection state.
- Participant accounts use one-time invitations, password login/recovery, expiring opaque sessions, revocation and researcher-only administration. No server database settings are present in the desktop app.
- Measurement batches are versioned, previewable, queued locally, retryable with bounded backoff and idempotent. Withdrawal discards unsent local batches and prevents further uploads.
- Optional free-text feedback is a separate, explicitly previewed submission. It is not accepted in routine telemetry batches, is reviewed separately by a researcher and is excluded from the ordinary research-event export.
- The hosted PHP/MySQL service uses exact CORS origins, non-wildcard headers, hashed session/invitation/recovery tokens, short-lived hashed abuse-throttling keys, pseudonym mapping separated from account email, and protected researcher routes.

## Local verification completed

- Frontend typecheck, 49 automated tests and production build passed.
- PHP syntax checks passed.
- A fresh MySQL schema applied successfully on MySQL 9.2 after correcting the reserved `condition` column and normalising ISO UTC event timestamps.
- Disposable end-to-end test passed: researcher sign-in; invitation; participant registration; rejected reused invitation; participant sign-in; no consent before opt-in; consent; accepted upload; accepted duplicate acknowledgement; rejected routine free text; accepted separate feedback; researcher feedback review; participant denial from administration; withdrawal; rejected upload after withdrawal; participant list without email; ordinary export without free-text feedback; rejected untrusted origin.
- A disposable MySQL backup was restored into a separate empty database. Counts matched across accounts, consent receipts, batches, events and feedback (`2:1:1:1:1`), and the reviewed feedback state was preserved.
- The current manifest and account-service test also passed: incomplete manifests were rejected; complete frozen manifests were accepted and duplicate-safe; researcher revocation stopped subsequent uploads; recovery reset invalidated old sessions and rejected token reuse; a second participant could not use another participant's pseudonym; and the account-request throttle returned `429` after its threshold. A final restore preserved the manifest-bearing event (`3:2:1:1:1` across accounts, consent receipts, batches, events and recovery tokens).
- After the final hardening pass, the live API accepted a complete event only when it included an evaluation run code, permitted research condition and all seven version-manifest fields; omitting the run code was rejected with `422`.
- Account-abuse control was refined and tested so successful sign-ins do not consume the limit for other participants sharing a network: ten valid sign-ins succeeded, while the ninth failed sign-in for the same account/network returned `429`.
- Desktop/server sign-out is now a real session revocation: the logout route succeeded and the same token was rejected immediately afterwards with `401`.
- Offline-grace expiry is also enforced by the upload serializer itself; the regression test proves it prevents collection without changing local workspace data.
- Expired invitation registration and expired recovery-token reset both failed safely with `403` in the disposable API test.
- The separate independent-quality workflow was exercised end-to-end: a participant was denied the researcher assessment route (`403`), a researcher recorded an instrument-versioned score and correction effort for an accepted pseudonymous run, and the protected export returned it in `independent_quality_assessments`.

## Required before inviting real participants

1. Deploy the service to the approved HTTPS subdomain with an actual private configuration, least-privilege database user and production recovery-mail provider.
2. Run the same protocol on the host’s staging database, including expiry and recovery-link cases, then record results.
3. Run and document the database backup-and-restore rehearsal, restoration access check, retention/withdrawal handling and deletion schedule on the hosting platform.
4. Configure the desktop release with the HTTPS service URL, conduct an end-user acceptance pass, and obtain research/supervisor approval for the consent wording and retention procedure.

Do not mark B09–B11 beta-ready until these hosted checks are evidenced.

## Completion audit — current state

| Checklist area | Local implementation and evidence | Remaining beta-gate evidence |
|---|---|---|
| B09 permitted-measurement contract | Allowlisted serializer and server validator reject private fields; only configured evaluation runs with condition and complete frozen manifest can upload. The 49-test frontend suite and live API tests cover injected private fields, missing manifests and missing run codes. Structured independent quality/correction-effort records are separate from participant ratings. | Protocol/ethics approval of the consent wording, retention schedule, scoring instrument and final model-profile/task-case identifiers. |
| B09 consent and local independence | Versioned consent, withdrawal and optional participation are implemented. Serializer offline-expiry regression test proves local workspace data remains untouched. | Participant-facing information sheet and documented approved server-side deletion/retention decision. |
| B10 identity and sessions | Invitation/register/login/recovery/reset/logout/revoke flows use separate account and pseudonym records, hashed opaque tokens and researcher-only routes. Live tests cover reuse/expiry, old-session invalidation, revocation and rate limiting. | Actual HTTPS origin, recovery email delivery, release renderer origin, and a hosted staging record. |
| B11 batching and feedback | Versioned batches, 50-batch local queue, retry/backoff, server deduplication, previewed separate feedback, separate review, protected administration/export and cross-participant isolation are implemented and locally exercised. | Hosted reconnect/retry observation, access-log configuration, off-host encrypted backup/recovery evidence and support procedure. |
| Service operations | Public-root rewrite file, private config example, daily token-maintenance command and least-privilege deployment instructions are present. | H01–H11 account-specific evidence in the shared-hosting plan, especially HTTPS, database user grants, cron, backup destination and load rehearsal. |
