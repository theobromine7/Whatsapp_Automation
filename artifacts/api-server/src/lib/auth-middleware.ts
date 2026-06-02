import { getAuth } from "firebase-admin/auth";
import { getApps } from "firebase-admin/app";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

declare global {
  namespace Express {
    interface Request {
      user?: { uid: string };
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // ── Dev bypass ───────────────────────────────────────────────────────────
  // When FIREBASE_SERVICE_ACCOUNT_JSON is not set, Firebase is not initialised.
  // In that case we skip token verification and inject a constant dev UID so
  // all ownerUid-scoped queries continue to work.
  // To enable real auth, set FIREBASE_SERVICE_ACCOUNT_JSON in your secrets.
  if (getApps().length === 0) {
    req.user = { uid: "dev-bypass" };
    next();
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice(7);

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = { uid: decoded.uid };
    next();
  } catch (err) {
    logger.warn({ err }, "Firebase token verification failed");
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
