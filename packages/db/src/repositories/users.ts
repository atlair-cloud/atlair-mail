import { eq } from "drizzle-orm";
import type { Executor } from "../client.ts";
import { users } from "../schema/index.ts";

export async function findUserIdByEmail(db: Executor, email: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()))
    .limit(1);
  return user?.id ?? null;
}
