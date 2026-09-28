# Synthetic audit evidence

Captured 20–21 September 2026 for the [verification record](../VERIFICATION_2026_09_21.md). These are developer diagnostic outputs, not participant research data.

- `store-probes.log`: current-behaviour assertions for baseline eligibility, dependency invalidation and scope coupling. Four passing tests include one fixture setup; they do not mean the defects are fixed.
- `final-actions.log`: successful small exports, before/after document-library text for cross-document Undo and incomplete SRS synchronization preview.
- `route-summary.json`: project route headings and captured page errors, excluding full page bodies.
- `approval-with-blocker.png`: approved requirement while the synthetic blocking finding remains.
- `document-undo.png`: duplicate document entries following cross-document undo.
- `source-hashes.json`: SHA-256 identifiers for key audited source files.

Preserve these observations when writing corrected-behaviour regression tests. Temporary reproduction scripts/build/workspace live under `BA_MATE/tmp/audit-2026-09-20/` and are not a release package.
