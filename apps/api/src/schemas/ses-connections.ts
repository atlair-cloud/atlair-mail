import { Type } from "typebox";
import { DateTime, Uuid } from "../lib/schemas.ts";

export const SaveSesConnectionSchema = Type.Object({
  region: Type.String({ pattern: "^[a-z]{2}(-[a-z]+)+-\\d+$", examples: ["us-east-1"] }),
  accessKeyId: Type.String({ pattern: "^[A-Z0-9]{16,128}$" }),
  secretAccessKey: Type.String({ minLength: 1, maxLength: 256, writeOnly: true }),
});

export const SesConnectionSchema = Type.Object({
  id: Uuid(),
  region: Type.String(),
  accessKeyId: Type.String(),
  configurationSet: Type.Union([Type.String(), Type.Null()]),
  createdAt: DateTime(),
  updatedAt: DateTime(),
});

export const SesAccountSchema = Type.Object({
  sendingEnabled: Type.Boolean(),
  productionAccessEnabled: Type.Boolean({
    description: "False while the AWS account is in the SES sandbox and can only send to verified addresses.",
  }),
  max24HourSend: Type.Number(),
  maxSendRate: Type.Number(),
});

export const SavedSesConnectionSchema = Type.Object({
  ...SesConnectionSchema.properties,
  account: SesAccountSchema,
});
