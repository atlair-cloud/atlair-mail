import { Type } from "typebox";

export const Uuid = () => Type.String({ format: "uuid" });

export const DateTime = () => Type.Unsafe<Date>(Type.String({ format: "date-time" }));
