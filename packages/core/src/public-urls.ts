import { parse } from "tldts";

export const maxPublicUrlLength = 2048;

export function normalizePublicUrl(input: string): string | null {
  if (input.length > maxPublicUrlLength || /[\s?#]/.test(input)) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const parsed = parse(url.hostname, { allowPrivateDomains: true });
  const registrable = parsed.isIcann === true || parsed.isPrivate === true;
  if (parsed.isIp || !parsed.domain || !registrable || parsed.hostname !== url.hostname) return null;
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}
