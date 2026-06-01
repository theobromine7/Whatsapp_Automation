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
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = header.slice(7);

  if (getApps().length === 0) {
    res.status(503).json({ error: "Authentication service unavailable" });
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
