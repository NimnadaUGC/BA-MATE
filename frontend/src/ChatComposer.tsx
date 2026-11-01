import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { AtSign } from 'lucide-react';
import type { ArtifactReference } from './types';

/** Both chat entry points use the same caret-aware, keyboard-operated mentions. */
export function MentionTextarea({ value, onChange, references, onAttach, onSend, label = 'Message BA Mate' }: {
  value: string; onChange: (value: string) => void; references: ArtifactReference[];
  onAttach: (reference: ArtifactReference) => void; onSend: () => void; label?: string;
}) {
  const id = useId();
  const input = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState(value.length);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const before = value.slice(0, caret);
  const match = before.match(/(?:^|\s)@([^@\n]{0,80})$/);
  const query = match?.[1].toLocaleLowerCase();
  const matches = query === undefined ? [] : references.filter(ref => `${ref.id} ${ref.label} ${ref.type}`.toLocaleLowerCase().includes(query)).slice(0, 10);
  const completed = query !== undefined && references.some(ref => query.startsWith(`${ref.id.toLocaleLowerCase()} `));
  const open = query !== undefined && !dismissed && !completed;
  const index = Math.min(active, Math.max(0, matches.length - 1));
  useEffect(() => { if (open) document.getElementById(`${id}-${index}`)?.scrollIntoView?.({ block: 'nearest' }); }, [open, index, id]);
  const attach = (ref: ArtifactReference) => {
    const start = caret - (match?.[1].length ?? 0) - 1;
    const text = `@${ref.id} `;
    onAttach(ref);
    onChange(value.slice(0, start) + text + value.slice(caret));
    setDismissed(true);
    requestAnimationFrame(() => { input.current?.focus(); input.current?.setSelectionRange(start + text.length, start + text.length); });
  };
  const keyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (open && ['ArrowDown', 'ArrowUp', 'Escape', 'Enter', 'Tab'].includes(event.key)) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDismissed(true); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); setActive((index + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % (matches.length || 1)); return;
      }
      if (!event.shiftKey && matches.length) { event.preventDefault(); attach(matches[index]); return; }
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); setDismissed(true); return; }
    }
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onSend(); }
  };
  return <div className="mention-input">
    <textarea ref={input} aria-label={label} value={value}
      role="combobox" aria-expanded={open} aria-autocomplete="list" aria-haspopup="listbox"
      aria-controls={open ? `${id}-mentions` : undefined} aria-activedescendant={open && matches.length ? `${id}-${index}` : undefined}
      onChange={event => { onChange(event.target.value); setCaret(event.target.selectionStart); setDismissed(false); setActive(0); }}
      onClick={event => { setCaret(event.currentTarget.selectionStart); setDismissed(false); }}
      onKeyUp={event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { setCaret(event.currentTarget.selectionStart); setDismissed(false); } }}
      onKeyDown={keyDown} placeholder="Ask BA Mate or type @ to reference project work…" />
    {open && <div id={`${id}-mentions`} className="chat-mention-menu" role="listbox" aria-label="Context mentions">
      <small>Attach context · ↑ ↓ to choose · Enter to attach · Esc to dismiss</small>
      {matches.map((ref, i) => <button type="button" id={`${id}-${i}`} key={`${ref.type}-${ref.id}`} role="option" aria-selected={index === i}
        onMouseDown={event => event.preventDefault()} onClick={() => attach(ref)}><AtSign size={16} /><span><b>{ref.id} · {ref.type}</b><small>{ref.label}</small></span></button>)}
      {!matches.length && <p role="status">No matching context. Try an item name or ID.</p>}
    </div>}
  </div>;
}
