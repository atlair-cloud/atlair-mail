const reservedHeaders = new Set([
  "bcc",
  "cc",
  "content-transfer-encoding",
  "content-type",
  "date",
  "dkim-signature",
  "from",
  "message-id",
  "mime-version",
  "received",
  "reply-to",
  "return-path",
  "sender",
  "subject",
  "to",
]);

export function findReservedHeaders(headers: Record<string, string>) {
  return Object.keys(headers).filter((name) => {
    const lower = name.toLowerCase();
    return reservedHeaders.has(lower) || lower.startsWith("content-");
  });
}
