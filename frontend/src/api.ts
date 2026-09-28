const configured = import.meta.env.VITE_BA_MATE_API_URL as string | undefined;
export const apiBase = configured ?? (typeof location !== 'undefined' && location.port !== '5173' ? location.origin : 'http://127.0.0.1:8000');
let session: Promise<string> | undefined;
async function token() {
  session ??= fetch(`${apiBase}/api/session`).then(async response => {
    if (!response.ok) throw new Error('The local BA Mate service is unavailable. Start BA Mate and try again.');
    return (await response.json()).token as string;
  }).catch(error => { session = undefined; throw error; });
  return session;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const secret = await token();
  const response = await fetch(`${apiBase}${path}`, {
    ...options, headers: { 'Content-Type': 'application/json', 'X-BA-Session': secret, ...options.headers },
  });
  if (!response.ok) {
    if (response.status === 401) session = undefined;
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === 'string' ? body.detail : Array.isArray(body.detail) ? body.detail.map((x: { msg: string }) => x.msg).join(' ') : `BA Mate returned ${response.status}.`;
    throw new Error(detail);
  }
  return response.json();
}
export type ProviderSettings = {
  provider: 'ollama' | 'openai' | 'gemini' | 'openrouter' | 'huggingface'; model: string; base_url: string;
  api_key?: string; has_key?: boolean; context_tokens: number; output_tokens: number;
  timeout_seconds: number; temperature: number; key_storage?: string;
};
export async function importSource(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file no larger than 10 MB.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('This file could not be read.'));
    reader.readAsDataURL(file);
  });
  return api<{ content: string; passages: { locator: string; text: string }[]; sha256: string; original_base64: string; limitations: string[] }>('/api/sources/extract', { method: 'POST', body: JSON.stringify({ name: file.name, data }) });
}
