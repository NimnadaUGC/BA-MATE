import { useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Guards source checking as well as inference; even providers ignoring abort cannot append late output. */
export function useChatRequest(identity: string) {
  const current = useRef<{ controller: AbortController; requestId?: string } | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const abort = () => {
    const request = current.current;
    current.current = undefined;
    if (!request) return;
    request.controller.abort();
    if (request.requestId) void api('/api/v1/workflow/cancel', { method: 'POST', body: JSON.stringify({ request_id: request.requestId }) }).catch(() => {});
  };
  useEffect(() => { setSending(false); return abort; }, [identity]);
  return {
    sending,
    begin: () => {
      if (current.current) return undefined;
      const request = { controller: new AbortController(), requestId: undefined as string | undefined };
      current.current = request;
      setSending(true);
      return request;
    },
    isCurrent: (request: { controller: AbortController }) => current.current === request && !request.controller.signal.aborted,
    finish: (request: { controller: AbortController }) => { if (current.current === request) { current.current = undefined; setSending(false); } },
    stop: () => { abort(); setSending(false); },
  };
}
