import { useEffect, useState } from 'react';

/** Read-only rendering of the exact proposal currently being reviewed. */
export function DiagramPreview({ source }: { source: string }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setSvg(''); setError('');
    const timer = window.setTimeout(async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', fontFamily: 'Inter, sans-serif' });
        const result = await mermaid.render(`proposal-${crypto.randomUUID()}`, source);
        if (active) setSvg(result.svg);
      } catch {
        if (active) setError('The diagram cannot be displayed yet. Check its Mermaid code before accepting it.');
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [source]);
  return <figure className="proposal-diagram-preview"><figcaption>Diagram preview — check its business meaning against the evidence</figcaption>{error ? <p role="alert">{error}</p> : svg ? <div role="img" aria-label="Proposed process diagram" dangerouslySetInnerHTML={{ __html: svg }} /> : <p role="status">Preparing diagram preview…</p>}</figure>;
}
