# BA Mate beta UI/UX implementation plan

Prepared 28 September 2026 for branch `update/ui-ux`.

The purpose of this work is to make the proposed BA workflow easy to
complete and difficult to bypass. It preserves the existing artifact,
revision, approval and research boundaries while simplifying the interface
presented to beta participants.

## Pass 1 — protect the evaluated workflow

- [x] Define visible completion criteria for Setup, Discover, Clarify,
  Define, Validate and Approve.
- [x] Prevent stage advancement when required work is incomplete.
- [x] Prevent a goal being marked complete before the governed final state.
- [x] Require stage feedback when a running evaluation requires it.
- [x] Explain every blocked action and link to the corrective screen.
- [x] Add domain tests for progression and completion rules.

## Pass 2 — simplify navigation

- [x] Make Overview and Guided workflow the primary project destinations.
- [x] Group materials, deliverables, review and advanced destinations.
- [x] Show one persistent current-stage/next-action treatment.
- [x] Keep advanced studios available without displaying fifteen peers at
  once.
- [x] Use participant-facing destination names.

## Pass 3 — consolidate BA Mate assistance

- [x] Present conversation and structured proposal generation as two clear
  modes of one assistant.
- [x] Use consistent context, evidence receipt, privacy and review language.
- [x] Avoid presenting two competing chat surfaces simultaneously.
- [x] Add persistent retry, connection-settings and manual-work recovery.

## Pass 4 — simplify working screens

- [x] Make source approval language task-oriented.
- [x] Give empty artifact screens one useful first action.
- [x] Separate document Edit, Review and Export concerns.
- [x] Replace research/developer terminology with participant language while
  retaining detailed metadata behind disclosure controls.
- [x] Review every empty, loading, success and error state.

## Pass 5 — accessibility and visual consistency

- [x] Bundle Google Sans Flex locally and remove remote font requests.
- [x] Apply it through global inheritance with script-safe system fallbacks.
- [x] Meet small-text contrast and practical text-size requirements.
- [x] Make closed navigation inert and remove hidden keyboard stops.
- [x] Add names/tooltips to collapsed icon navigation.
- [x] Verify keyboard, focus, zoom and laptop/mobile layouts.

## Pass 6 — remove beta-breaking prototype residue

- [x] Remove or isolate simulated invitations, example transformations and
  generic mock actions from participant journeys.
- [x] Rename Research console to Study participation for participants.
- [x] Keep researcher administration role-gated.
- [x] Provide in-app beta guidance for privacy, AI connection, stage work,
  backups and recovery.
- [x] Update participant documentation to match the released interface.

## Release verification

- [x] Typecheck, frontend tests and production build pass.
- [x] Backend tests pass.
- [x] Three complete governed BA journeys pass in the domain test suite.
- [x] Manual-only and unavailable-model recovery paths pass.
- [x] Keyboard-only, 200% equivalent viewport, 1366×768 and narrow-layout checks pass.
- [x] No visible participant action is simulated or silently bypasses a gate.

## Verification evidence

- `workflowReadiness.test.ts` covers Setup through Approve, direct-baseline
  bypass prevention, completion requirements and three independent seeded
  project journeys.
- In-app browser smoke checks covered all 14 project destinations and all six
  global destinations with no runtime alert or horizontal overflow.
- Responsive checks covered 1366×768, 768×900, 390×844 and a 683×384
  high-zoom-equivalent viewport. The mobile navigation focus trap and focus
  restoration were exercised with the keyboard.
- A rendered-text audit found no sub-24px text below a 4.5:1 contrast ratio on
  the primary workflow surface after the contrast corrections.
- The production build contains the Latin, Latin Extended and Symbols Google
  Sans Flex WOFF2 subsets plus the OFL licence; application source contains no
  remote Google Fonts import.
