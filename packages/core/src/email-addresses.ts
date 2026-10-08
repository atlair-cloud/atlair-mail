import emailAddresses from "email-addresses";
import { normalizeDomainName } from "./domain-names.ts";

export interface Mailbox {
  name: string | null;
  address: string;
  domain: string;
}

const maxAddressLength = 320;
const controlCharacters = /[\u0000-\u001f\u007f]/;
const dotAtomLocalPart = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;

export function parseMailbox(input: string): Mailbox | null {
  const candidate = input.trim();
  if (!candidate || candidate.length > maxAddressLength || controlCharacters.test(candidate)) return null;
  const parsed = emailAddresses.parseOneAddress({ input: candidate, rejectTLD: true, rfc6532: true });
  if (!parsed || parsed.type !== "mailbox") return null;
  if (parsed.local.length > 64 || !dotAtomLocalPart.test(parsed.local)) return null;
  const domain = normalizeDomainName(parsed.domain);
  if (!domain) return null;
  const name = parsed.name?.trim() || null;
  return { name, address: `${parsed.local}@${domain}`, domain };
}

export function formatMailbox({ name, address }: Mailbox) {
  return name ? `"${name.replace(/[\\"]/g, "\\$&")}" <${address}>` : address;
}
