import { API_URL, apiFetchUrl } from '../services/api';

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<{
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}>;

export async function translateGermanToEnglish(
  text: string,
  fetcher: FetchLike = apiFetchUrl,
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const apiBase = API_URL;
  const response = await fetcher(`${apiBase}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: trimmed, source: 'de', target: 'en' }),
  });
  if (!response.ok) {
    throw new Error(`Translation request failed${response.status ? `: ${response.status}` : ''}`);
  }

  const data = await response.json() as { translation?: unknown };
  const translated = typeof data.translation === 'string' ? data.translation.trim() : '';

  return translated || trimmed;
}
