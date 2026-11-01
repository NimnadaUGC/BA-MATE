import type { Source } from "./types";

/** Search-only normalization; the stored extraction and original stay unchanged. */
export const normalizeSearchText = (text: string) => text.normalize("NFKC").replace(/\s+/gu, " ").trim();

export function searchSourcePassages(sources: Source[], query: string) {
  const needle = normalizeSearchText(query).toLowerCase();
  if (needle.length < 2) return [];
  return sources.flatMap(source => {
    const passages = source.passages?.length ? source.passages : [{ locator: "Document", text: source.content ?? "" }];
    const nameMatch = normalizeSearchText(`${source.name} ${source.relativePath ?? ""}`).toLowerCase().includes(needle);
    return passages.flatMap(passage => {
      const text = normalizeSearchText(passage.text);
      const at = text.toLowerCase().indexOf(needle);
      if (at < 0 && !nameMatch) return [];
      const start = Math.max(0, (at < 0 ? 0 : at) - 80);
      const end = Math.min(text.length, (at < 0 ? 0 : at + needle.length) + 120);
      return [{ source, passage, before: `${start ? "…" : ""}${text.slice(start, at < 0 ? end : at)}`, match: at < 0 ? "" : text.slice(at, at + needle.length), after: `${at < 0 ? "" : text.slice(at + needle.length, end)}${end < text.length ? "…" : ""}`, nameMatch: at < 0 }];
    }).slice(0, 30);
  }).slice(0, 40);
}
