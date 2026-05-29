import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, businessesTable } from "@workspace/db";
import {
  ListBusinessesResponse,
  GetBusinessParams,
  GetBusinessResponse,
  CreateBusinessBody,
  UpdateBusinessParams,
  UpdateBusinessBody,
  UpdateBusinessResponse,
  DeleteBusinessParams,
  ToggleBusinessParams,
  ToggleBusinessResponse,
  ConnectBusinessMetaParams,
  ConnectBusinessMetaBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/businesses", async (req, res): Promise<void> => {
  const businesses = await db
    .select()
    .from(businessesTable)
    .orderBy(businessesTable.createdAt);
  res.json(ListBusinessesResponse.parse(businesses));
});

router.post("/businesses", async (req, res): Promise<void> => {
  const parsed = CreateBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid business input");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [business] = await db
    .insert(businessesTable)
    .values({ ...parsed.data, connectionType: "pending" })
    .returning();
  res.status(201).json(GetBusinessResponse.parse(business));
});

router.get("/businesses/:id", async (req, res): Promise<void> => {
  const params = GetBusinessParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [business] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.id, params.data.id));
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  res.json(GetBusinessResponse.parse(business));
});

router.patch("/businesses/:id", async (req, res): Promise<void> => {
  const params = UpdateBusinessParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateBusinessBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [business] = await db
    .update(businessesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(businessesTable.id, params.data.id))
    .returning();

  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  res.json(UpdateBusinessResponse.parse(business));
});

router.delete("/businesses/:id", async (req, res): Promise<void> => {
  const params = DeleteBusinessParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [business] = await db
    .delete(businessesTable)
    .where(eq(businessesTable.id, params.data.id))
    .returning();
  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  res.sendStatus(204);
});

router.patch("/businesses/:id/toggle", async (req, res): Promise<void> => {
  const params = ToggleBusinessParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [existing] = await db
    .select()
    .from(businessesTable)
    .where(eq(businessesTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  const [business] = await db
    .update(businessesTable)
    .set({ isActive: !existing.isActive, updatedAt: new Date() })
    .where(eq(businessesTable.id, params.data.id))
    .returning();

  res.json(ToggleBusinessResponse.parse(business));
});

// Connect a business via Meta Cloud API credentials
router.post("/businesses/:id/connect-meta", async (req, res): Promise<void> => {
  const params = ConnectBusinessMetaParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = ConnectBusinessMetaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [business] = await db
    .update(businessesTable)
    .set({
      ...parsed.data,
      connectionType: "meta_cloud",
      sessionStatus: null,
      connectedPhone: null,
      updatedAt: new Date(),
    })
    .where(eq(businessesTable.id, params.data.id))
    .returning();

  if (!business) {
    res.status(404).json({ error: "Business not found" });
    return;
  }

  res.json(GetBusinessResponse.parse(business));
});

export default router;
