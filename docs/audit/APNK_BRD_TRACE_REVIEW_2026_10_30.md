# APNK Mini POS: BRD-to-draft trace review

30 October 2026. This is an analyst review worksheet, not verified traceability, an approved specification, or an executed POS test. The reference is the four-page BRD retained in the APNK POS NEW v33 backup, source `SRC-01` revision 3, SHA-256 `f376bd0617a5340d988ddac36ebae64ff6567b2d720fe556d67e5e421a651740`. The original bytes in that backup match the recorded hash. Page references below use the PDF's physical page numbers. The draft IDs are the six working requirements in that backup; all mappings require human review against the actual source and current project revision.

## Numbered functional requirements

| BRD item and location | Source intent, paraphrased | Current draft record | Review or refinement needed |
| --- | --- | --- | --- |
| REQ-AUTH-01, p. 2 §4.1 | Login with a unique username and PIN/password. | FR-1e864008 | Separate login from role restrictions; account creation, credential rules and failed-login behavior remain open. |
| REQ-AUTH-02, p. 2 §4.1 | Restrict administrative functions, including inventory restock and EOD reports, to Store Manager. | FR-1e864008 | Separate access control from login and review the full role matrix; the examples do not define every administrative function. |
| REQ-POS-01, p. 2 §4.2 | Scan with a connected barcode scanner or enter barcode/SKU manually. | FR-7221708b | Split product identification from cart, calculation and payment; define unrecognized or ambiguous item behavior with stakeholders. |
| REQ-POS-02, p. 2 §4.2 | On a scan, display product name, unit price, quantity and line total. | FR-7221708b | Capture each displayed value and triggering condition. The BRD says “when an item is scanned”; whether identical behavior applies to manual entry needs review. |
| REQ-POS-03, p. 2 §4.2 | Before payment, adjust quantity or delete a cart item. | FR-7221708b | Split cart changes into independently reviewable behavior; confirm allowable quantities and restrictions. Deleting a cart item is not automatically a completed-transaction void. |
| REQ-POS-04, p. 3 §4.2 | Automatically calculate subtotal, applicable taxes, discounts and final total. | FR-7221708b | Define tax, discount eligibility, ordering, combinations and rounding with stakeholders; the draft has no confirmed examples. |
| REQ-POS-05, p. 3 §4.2 | Support cash, credit/debit card, and split cash/card payment. | FR-7221708b | Keep payment methods independently traceable. Card networks and external integration are unanswered; partial-payment and failure handling are also open. |
| REQ-POS-06, p. 3 §4.2 | For cash, prompt for amount tendered and accurately calculate change. | FR-7221708b | The prompt was subsequently added to the working requirement and SRS; review the current revision. Confirm behavior for insufficient tender and rounding; do not invent expected results. |
| REQ-INV-01, p. 3 §4.3 | Immediately deduct purchased quantities from active inventory after a successful transaction. | FR-4b7abe0f | Separate deduction from low-stock alerts; define successful transaction and recovery when inventory deduction fails. |
| REQ-INV-02, p. 3 §4.3 | The system **should** flag stock below a predefined threshold; fewer than five units is an example. | FR-4b7abe0f | Preserve “should”; threshold and unit are unanswered. Do not treat the example as the decision or make the alert mandatory without confirmation. |
| REQ-REP-01, p. 3 §4.4 | On payment completion, generate a digital receipt and trigger a command to the receipt printer. | FR-7221708b | Separate receipt and printing from checkout. The scope on p. 1 mentions printable/digital format simulation, so confirm the intended printer or test environment and failure handling. |
| REQ-REP-02, p. 3 §4.4 | Store Manager generates an EOD Z-Report with sales, taxes, payment breakdowns and drawer balance. | FR-266e56ef | Retain distinct record; confirm reporting period, calculation and reconciliation rules and expected results. |

## Scope and roles outside the numbered list

- Page 1 scope mentions item-level and cart-level discounts. The broad checkout draft mentions discounts but does not yet state both levels or their rules as independently reviewable requirement records. The SRS prose notes both; it is not a verified link.
- Page 2 role table assigns Cashiers register open/close, daily history and returns, and Store Managers inventory add/update and transaction voids. Draft FR-dc270563 and FR-8d3cafa1 cover some role capabilities, but their detailed rules remain open. Returns and completed-transaction voids need scoped requirements and stakeholder decisions; the page 4 cart-item deletion scenario does not resolve them.
- Pages 3–4 present scenario outlines for cash checkout, split payment, cart modification/discount and manager reporting. They are proposed scenarios, not test results. Expected results need agreed test data and rules before execution.

## Suggested next actions

1. In the project, split the compound draft requirements into independently reviewable records, preserving source strength, scope, original relationships and revision history. Do not mark existing links verified merely because a row appears above.
2. Add the missing cash-tender prompt explicitly, and compare each candidate acceptance criterion against the actual BRD passage; distinguish a source requirement from a proposed clarification or test.
3. Link each new record to the relevant source revision, then have a business analyst review the relationship and its current revision. The application now supports revision-pinned passage selection, including multiple pages. Selected locations remain pending review and do not establish semantic support.
4. Keep the low-stock threshold, card integration, payment failure and recovery, and returns/voids unanswered until appropriate stakeholders decide them. Review tax, discount, receipt and reporting rules as separate open questions.
5. Reconcile the SRS document and diagram with the revised records, review pending evidence links, and generate a new working export. A verified link still requires semantic review; it is not proof of a correct requirement or stakeholder approval.


## Later checkout correction

On 30 October the real checkout draft was revised to FR-7221708b v6, Draft and Out of sync. It distinguishes the BRD’s scan-specific item display from the unconfirmed manual-entry behavior and includes manual barcode or SKU entry. SRS v43 and draft diagram v3 reflect that distinction. The single broad record still combines multiple BRD items and requires refinement.
