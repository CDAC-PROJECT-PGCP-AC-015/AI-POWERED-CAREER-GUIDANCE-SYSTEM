import { db } from "./db/client.js";
import { systemLogs } from "./db/schema.js";

export async function logEvent(userId: string | null, eventType: string, details: unknown = {}) {
  try {
    await db.insert(systemLogs).values({ userId: userId ?? undefined, eventType, details: details as any });
  } catch (err) {
    // Logging should never break the request it's attached to.
    console.error("[logEvent] failed:", err);
  }
}
