import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

export const msUntilEarliest = (column: PgColumn): SQL<number | null> =>
  sql<number | null>`(extract(epoch from min(${column}) - now()) * 1000)::float8`;
