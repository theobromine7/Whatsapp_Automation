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
  if (getApps().length === 0) {
    req.user = { uid: "dev-bypass" };
    next();
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  // Accept token from Authorization header OR ?token= query param (for EventSource / SSE)
  let token: string | undefined;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    token = header.slice(7);
  } else if (typeof req.query.token === "string" && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    req.user = { uid: decoded.uid };
    next();
  } catch (err) {
    logger.warn({ err }, "Firebase token verification failed");
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
