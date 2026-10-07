import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const sha256 = (value: string) => createHash("sha256").update(value).digest();

export const hashApiKeyToken = (token: string) => sha256(token).toString("hex");

export function generateApiKeyToken() {
  const token = `am_${randomBytes(32).toString("base64url")}`;
  return { token, tokenHash: hashApiKeyToken(token), tokenPrefix: token.slice(0, 7) };
}

export const tokensMatch = (presented: string, expected: string) =>
  timingSafeEqual(sha256(presented), sha256(expected));
