import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, businessesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth-middleware";

const router: IRouter = Router();

router.delete("/account", requireAuth, async (req, res): Promise<void> => {
  const uid = req.user!.uid;
  try {
    await db.delete(businessesTable).where(eq(businessesTable.ownerUid, uid));
    res.sendStatus(204);
  } catch (err) {
    req.log.error({ err }, "Failed to delete account");
    res.status(500).json({ error: "Failed to delete account" });
  }
});

export default router;
