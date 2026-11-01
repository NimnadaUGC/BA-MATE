# BA Mate shared research service

This is the PHP/MySQL service intended for the separate research subdomain. It is not part of the desktop loopback API and must never be bundled in a desktop installer.

## Deployment boundary

1. Create a dedicated MySQL database/user with only this schema's privileges.
2. Apply schema.sql using the database's migration process.
3. Copy config.example.php to a private directory outside the document root, set BA_MATE_RESEARCH_CONFIG to that file, and configure the host-approved recovery-mail sender.
   Review allowed_origins for the exact released desktop loopback origins and set `quality_instrument_version` to the approved rubric; never set a wildcard.
4. Point the HTTPS-only subdomain document root at public/. Do not expose schema.sql, config files, or database backups.
5. Bootstrap the first researcher account only from the server shell using scripts/bootstrap_researcher.php. Deliver its generated one-time password through an approved channel, then require a recovery reset. No default password or public bootstrap route exists.
6. Test invitation, expired/reused invitation, recovery, sign-out, revocation, consent, duplicate batch, withdrawal, backup, and restore on a staging database before collection.
7. Schedule `php scripts/maintenance.php /private/config.php` daily through the hosting cron facility. It clears expired account-control tokens and short-lived abuse-throttle keys; it does not delete research records.

Use [the hosted staging protocol](../docs/hosting/B09_B11_STAGING_PROTOCOL.md) to collect the final redacted evidence before any real invitation is issued.

For a desktop release that is authorised to collect research measurements, copy `frontend/.env.example` to the release build environment and set `VITE_BA_MATE_RESEARCH_URL` to this exact HTTPS origin. That value is a public service address only; do not put a database URL, password, API key or mail credential in the desktop build.

The service stores account/contact identity separately from study pseudonyms and collection events. The collection endpoint rejects arbitrary fields and known private-content field names. It never receives a workspace, project name, source, filename, prompt, model response, document, content hash, provider credential, or database credential.

## Offline policy

Desktop BA work and backups remain local and available without an account or network connection. A signed-in desktop may display its server-issued offline-grace date, but may queue only B09 allowlisted batches while active consent remains recorded locally and the grace timestamp has not passed. On reconnection it rechecks account and consent status; a revoked or withdrawn account cannot submit a queue. Withdrawing consent stops new collection and the desktop discards unsent batches. Server-side withdrawal does not delete private local projects.

## Backup and retention

Back up the database with encrypted, access-restricted exports to a researcher-controlled off-host destination. Restore only to an isolated database first, verify consent/provenance and record the rehearsal. Retention and irreversible withdrawal/deletion decisions must be set from the approved ethics/protocol materials before collecting real data.
