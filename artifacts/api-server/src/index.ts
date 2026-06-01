import app from "./app";
import { logger } from "./lib/logger";
import { restoreActiveSessions } from "./lib/session-manager";
import { db, whatsappConversationsTable } from "@workspace/db";
import { and, eq, lte } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  restoreActiveSessions().catch((err) => {
    logger.error({ err }, "Failed to restore WhatsApp sessions");
  });

  // ── Auto-resume interval ────────────────────────────────────────────────
  // Every 5 minutes: reset OWNER_TAKEN_OVER conversations where the owner
  // has been silent for at least 30 minutes.
  setInterval(async () => {
    try {
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const resumed = await db
        .update(whatsappConversationsTable)
        .set({ aiState: "AI_ACTIVE" })
        .where(
          and(
            eq(whatsappConversationsTable.aiState, "OWNER_TAKEN_OVER"),
            lte(whatsappConversationsTable.ownerLastMessageAt, thirtyMinutesAgo)
          )
        )
        .returning({ id: whatsappConversationsTable.id });
      if (resumed.length > 0) {
        logger.info({ count: resumed.length }, "Auto-resumed AI for conversations after 30 min owner silence");
      }
    } catch (err) {
      logger.error({ err }, "Auto-resume check failed");
    }
  }, 5 * 60 * 1000);
  // ────────────────────────────────────────────────────────────────────────
});
