# Framework and implementation diagrams

## Current research specification — September 2026

The proposed research specification is now [F4-draft.1](../../Framework/Specification/FRAMEWORK_SPECIFICATION.md). Its [diagram guide](../../Framework/Diagrams/README.md) provides lifecycle, governance and information-model views with editable sources and visual exports. The [research index](../../RESEARCH_INDEX.md) connects the contribution, framework and evaluation protocol.

The core lifecycle is **Scope → evidence → clarification → requirements and criteria → process model → validation → document → approval → change**. Developer handover is an optional artifact export, not a mandatory stage. F4 is a pre-evaluation specification; this documentation update does not establish that the application implements all of it.

## Historical implementation reference — 0.4 pilot

The 0.4 pilot's research mechanism was represented in [BA Framework v3](../../Framework/Diagrams/BA%20Framework%20v3.mmd). BA Mate's local architecture is represented in [application diagram v4](Diagram/ba-mate%20diagram%20v4.mmd). These remain historical implementation/design references; research and application diagram numbering are independent.

Version 3 makes evidence review, clarification decisions, human correction, trace verification and revalidation explicit. Outcome improvements are hypotheses to measure, rather than guaranteed outputs. Model inference is replaceable; the framework does not depend on training a new model or on parallel agents.

Application version 4 distinguishes local functionality from future shared services. Team membership records are local workflow metadata, not authenticated collaboration. An approved source means its extraction was reviewed; it does not establish that every AI statement citing it is supported.

The application uses Setup → Discover → Clarify → Define → Validate → Approve as navigation gates. The research diagram groups the underlying mechanisms rather than implying that every case must follow a rigid sequence. BAs can revisit clarification and validation as evidence changes. Baseline checks cover authority, blockers, reviewed artifact status and verified requirement/story evidence paths. They do not automatically establish stakeholder agreement, legal compliance or artifact correctness.

Both diagrams are editable Mermaid files. Solid arrows indicate process or data movement; dashed arrows indicate research feedback or future scope.
