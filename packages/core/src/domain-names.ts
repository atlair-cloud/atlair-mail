import { domainToASCII } from "node:url";
import { parse } from "tldts";

const hostnameCharacters = /^[\p{L}\p{M}\p{N}.-]+$/u;

export function normalizeDomainName(input: string): string | null {
  const candidate = input.trim().toLowerCase().replace(/\.$/, "");
  if (!hostnameCharacters.test(candidate)) return null;
  const ascii = domainToASCII(candidate);
  if (!ascii || ascii.length > 253) return null;
  const parsed = parse(ascii);
  if (parsed.hostname !== ascii || parsed.isIp || !parsed.domain || parsed.isIcann !== true) return null;
  return ascii;
}
