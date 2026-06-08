import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, businessesTable } from "@workspace/db";
import {
  startSession,
  stopSession,
  addSSEClient,
  removeSSEClient,
  getSessionStatus,
} from "../lib/session-manager";
import { requireAuth } from "../lib/auth-middleware";

const router: IRouter = Router();

function parseBusinessId(param: string | string[]): number {
  return parseInt(Array.isArray(param) ? param[0]! : param, 10);
}

async function getOwnedBusiness(businessId: number, uid: string) {
  const [b] = await db
    .select()
    .from(businessesTable)
    .where(and(eq(businessesTable.id, businessId), eq(businessesTable.ownerUid, uid)));
  return b ?? null;
}

router.post("/sessions/:businessId/start", requireAuth, async (req, res): Promise<void> => {
  const businessId = parseBusinessId(req.params.businessId!);
  const business = await getOwnedBusiness(businessId, req.user!.uid);
  if (!business) { res.status(404).json({ error: "Business not found" }); return; }

  startSession(businessId).catch((err) => {
    req.log.error({ err, businessId }, "Session start failed");
  });

  res.json({ businessId, status: "starting" });
});

router.get("/sessions/:businessId/qr-stream", requireAuth, (req, res): void => {
  const businessId = parseBusinessId(req.params.businessId!);

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

router.get("/sessions/:businessId/status", requireAuth, async (req, res): Promise<void> => {
  const businessId = parseBusinessId(req.params.businessId!);
  const business = await getOwnedBusiness(businessId, req.user!.uid);
  if (!business) { res.status(404).json({ error: "Business not found" }); return; }

  const memStatus = getSessionStatus(businessId);

  res.json({
    businessId,
    status: memStatus.status !== "no_session" ? memStatus.status : (business.sessionStatus ?? "no_session"),
    connectedPhone: memStatus.connectedPhone ?? business.connectedPhone,
  });
});

router.post("/sessions/:businessId/pairing-code", requireAuth, async (req, res): Promise<void> => {
  const businessId = parseBusinessId(req.params.businessId!);
  const business = await getOwnedBusiness(businessId, req.user!.uid);
  if (!business) { res.status(404).json({ error: "Business not found" }); return; }

  const rawPhone = (req.body as { phone?: string }).phone ?? "";
  const phone = rawPhone.replace(/\D/g, ""); // digits only, e.g. "919876543210"
  if (!phone || phone.length < 7) { res.status(400).json({ error: "Valid phone number required (with country code)" }); return; }

  startSession(businessId, phone).catch((err) => {
    req.log.error({ err, businessId }, "Pairing session start failed");
  });

  res.json({ businessId, status: "starting" });
});

router.post("/sessions/:businessId/disconnect", requireAuth, async (req, res): Promise<void> => {
  const businessId = parseBusinessId(req.params.businessId!);
  const business = await getOwnedBusiness(businessId, req.user!.uid);
  if (!business) { res.status(404).json({ error: "Business not found" }); return; }

  await stopSession(businessId);
  res.json({ businessId, status: "disconnected" });
});

export default router;
