import { Type } from "typebox";
import { domainStatuses } from "@atlair-mail/db";
import { DateTime, Uuid } from "../lib/schemas.ts";

export const DnsRecordSchema = Type.Object({
  record: Type.Enum(["DKIM", "SPF", "MX", "DMARC"]),
  type: Type.Enum(["CNAME", "TXT", "MX"]),
  name: Type.String(),
  value: Type.String(),
  required: Type.Boolean({ description: "Required records must be published to verify. DMARC is recommended for deliverability." }),
});

export const DomainSchema = Type.Object({
  id: Uuid(),
  name: Type.String(),
  status: Type.Enum(domainStatuses, {
    description: "Only verified domains can send. A domain whose records are not found in time is marked failed.",
  }),
  records: Type.Array(DnsRecordSchema),
  lastCheckedAt: Type.Union([DateTime(), Type.Null()]),
  verifiedAt: Type.Union([DateTime(), Type.Null()]),
  createdAt: DateTime(),
});

export const CreateDomainSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 253, examples: ["example.com"] }),
});
