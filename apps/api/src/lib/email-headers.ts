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

const fieldName = /^[!-9;-~]{1,100}$/;

export function findInvalidHeaderNames(headers: Record<string, string>) {
  return Object.keys(headers).filter((name) => !fieldName.test(name));
}

export function findReservedHeaders(headers: Record<string, string>) {
  return Object.keys(headers).filter((name) => {
    const lower = name.toLowerCase();
    return reservedHeaders.has(lower) || lower.startsWith("content-");
  });
}
