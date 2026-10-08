import { Type } from "typebox";
import { domainStatuses } from "@atlair-mail/db";
import { DateTime, Uuid } from "../lib/schemas.ts";

export const DnsRecordSchema = Type.Object({
  record: Type.Enum(["DKIM", "DMARC"]),
  type: Type.Enum(["CNAME", "TXT"]),
  name: Type.String(),
  value: Type.String(),
  required: Type.Boolean({ description: "DKIM records are required to verify. DMARC is recommended for deliverability." }),
});

export const DomainSchema = Type.Object({
  id: Uuid(),
  name: Type.String(),
  status: Type.Enum(domainStatuses, {
    description: "Only verified domains can send. SES stops checking DNS 72 hours after the domain is added and marks it failed.",
  }),
  records: Type.Array(DnsRecordSchema),
  lastCheckedAt: Type.Union([DateTime(), Type.Null()]),
  verifiedAt: Type.Union([DateTime(), Type.Null()]),
  createdAt: DateTime(),
});

export const CreateDomainSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 253, examples: ["example.com"] }),
});
