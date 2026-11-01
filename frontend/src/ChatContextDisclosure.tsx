import type { ModelContextReceipt } from './types';

export function ChatContextDisclosure({ receipt }: { receipt: ModelContextReceipt }) {
  return <details className="chat-context-disclosure"><summary>View request context</summary>
    <p><b>Included:</b> {receipt.includedReferenceIds.join(', ') || 'No project items'}</p>
    {!!receipt.partialReferenceIds?.length && <p><b>Partially included:</b> {receipt.partialReferenceIds.join(', ')}</p>}
    {!!receipt.omittedReferenceIds.length && <p><b>Omitted:</b> {receipt.omittedReferenceIds.join(', ')}</p>}
    {!!receipt.historyMessagesOmitted && <p>{receipt.historyMessagesOmitted} earlier conversation messages were omitted to fit the model’s context limit.</p>}
  </details>;
}
