import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, businessesTable } from "@workspace/db";
import {
  startSession,
  stopSession,
  addSSEClient,
  removeSSEClient,
  getSessionStatus,
} from "../lib/session-manager";

const router: IRouter = Router();

router.post("/sessions/:businessId/start", async (req, res): Promise<void> => {
  const businessId = parseInt(
    Array.isArray(req.params.businessId) ? req.params.businessId[0] : req.params.businessId,
    10
  );

  const [business] = await db.select().from(businessesTable).where(eq(businessesTable.id, businessId));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  startSession(businessId).catch((err) => {
    req.log.error({ err, businessId }, "Session start failed");
  });

  res.json({ businessId, status: "starting" });
});

router.get("/sessions/:businessId/qr-stream", (req, res): void => {
  const businessId = parseInt(
    Array.isArray(req.params.businessId) ? req.params.businessId[0] : req.params.businessId,
    10
  );

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: "connected_to_stream" })}\n\n`);

  addSSEClient(businessId, res);

  req.on("close", () => {
    removeSSEClient(businessId, res);
  });
});

router.get("/sessions/:businessId/status", async (req, res): Promise<void> => {
  const businessId = parseInt(
    Array.isArray(req.params.businessId) ? req.params.businessId[0] : req.params.businessId,
    10
  );

  const [business] = await db.select().from(businessesTable).where(eq(businessesTable.id, businessId));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  const memStatus = getSessionStatus(businessId);

  res.json({
    businessId,
    status: memStatus.status !== "no_session" ? memStatus.status : (business.sessionStatus ?? "no_session"),
    connectedPhone: memStatus.connectedPhone ?? business.connectedPhone,
  });
});

router.post("/sessions/:businessId/disconnect", async (req, res): Promise<void> => {
  const businessId = parseInt(
    Array.isArray(req.params.businessId) ? req.params.businessId[0] : req.params.businessId,
    10
  );

  await stopSession(businessId);
  res.json({ businessId, status: "disconnected" });
});

export default router;
