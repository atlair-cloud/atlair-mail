import { Type } from "typebox";
import { domainStatuses } from "@atlair-mail/db";
import { DateTime, Uuid } from "../lib/schemas.ts";
import { AuthorshipSchema } from "./authors.ts";

export const DnsRecordSchema = Type.Object({
  record: Type.Enum(["DKIM", "MAIL_FROM", "SPF", "DMARC"]),
  type: Type.Enum(["CNAME", "TXT", "MX"]),
  name: Type.String(),
  value: Type.String(),
  priority: Type.Optional(Type.Integer({ description: "MX priority." })),
  required: Type.Boolean({
    description: "Required records must be published to send. The others improve deliverability.",
  }),
  status: Type.Union([Type.Enum(["pending", "verified", "failed"]), Type.Null()], {
    description: "Whether the provider has found this record. Null for records the provider does not check.",
  }),
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
  ...AuthorshipSchema,
});

export const CreateDomainSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 253, examples: ["example.com"] }),
});
