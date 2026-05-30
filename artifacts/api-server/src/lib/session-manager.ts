import path from "path";
import fs from "fs";
import { eq } from "drizzle-orm";
import { db, businessesTable } from "@workspace/db";
import { handleIncomingMessage, findBusinessByConnectedPhone } from "./message-handler";
import { logger } from "./logger";
import type { Response } from "express";

const SESSIONS_DIR = path.resolve(process.cwd(), ".sessions");

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

interface SessionEntry {
  socket: unknown;
  sseClients: Set<Response>;
  status: "connecting" | "connected" | "disconnected";
  qrDataUrl: string | null;
  connectedPhone: string | null;
  connectAttempts: number;
}

const sessions = new Map<number, SessionEntry>();
const restartTimers = new Map<number, ReturnType<typeof setTimeout>>();

function clearRestartTimer(businessId: number): void {
  const timer = restartTimers.get(businessId);
  if (timer) {
    clearTimeout(timer);
    restartTimers.delete(businessId);
  }
}

function getSessionDir(businessId: number): string {
  const dir = path.join(SESSIONS_DIR, String(businessId));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function broadcastToSSE(businessId: number, data: Record<string, unknown>): void {
  const entry = sessions.get(businessId);
  if (!entry) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of entry.sseClients) {
    try {
      client.write(payload);
    } catch {
      entry.sseClients.delete(client);
    }
  }
}

export async function startSession(businessId: number): Promise<void> {
  clearRestartTimer(businessId);
  await stopSession(businessId);

  const existing = sessions.get(businessId);
  const entry: SessionEntry = {
    socket: null,
    sseClients: existing?.sseClients ?? new Set(),
    status: "connecting",
    qrDataUrl: null,
    connectedPhone: null,
    connectAttempts: (existing?.connectAttempts ?? 0) + 1,
  };
  sessions.set(businessId, entry);

  await db
    .update(businessesTable)
    .set({ sessionStatus: "pending", connectedPhone: null, connectionType: "qr_session", updatedAt: new Date() })
    .where(eq(businessesTable.id, businessId));

  // Lazy-import Baileys to avoid bundling issues
  const baileys = await import("@whiskeysockets/baileys");
  const QRCode = await import("qrcode");

  const { state, saveCreds } = await baileys.useMultiFileAuthState(getSessionDir(businessId));
  const { version } = await baileys.fetchLatestBaileysVersion();

  const sock = baileys.makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logger: {
      level: "warn",
      trace: () => {}, debug: () => {}, info: () => {},
      warn:  (obj: unknown, msg?: string) => logger.warn({ baileys: obj }, msg ?? "Baileys warn"),
      error: (obj: unknown, msg?: string) => logger.error({ baileys: obj }, msg ?? "Baileys error"),
      fatal: (obj: unknown, msg?: string) => logger.error({ baileys: obj }, msg ?? "Baileys fatal"),
      child: () => ({ level: "warn", trace: () => {}, debug: () => {}, info: () => {},
        warn:  (o: unknown, m?: string) => logger.warn({ baileys: o }, m ?? "Baileys warn"),
        error: (o: unknown, m?: string) => logger.error({ baileys: o }, m ?? "Baileys error"),
        fatal: (o: unknown, m?: string) => logger.error({ baileys: o }, m ?? "Baileys fatal"),
        child: () => ({}) }),
    } as any,
    browser: ["NexusAgent", "Chrome", "1.0.0"],
    syncFullHistory: false,
  });

  entry.socket = sock;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const qrDataUrl = await QRCode.default.toDataURL(qr, { width: 300, margin: 2 });
        entry.qrDataUrl = qrDataUrl;
        broadcastToSSE(businessId, { type: "qr", qrDataUrl });
        logger.info({ businessId }, "QR code generated");
      } catch (err) {
        logger.error({ err, businessId }, "Failed to generate QR code image");
      }
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      const loggedOut = statusCode === baileys.DisconnectReason.loggedOut;
      const wasConnected = entry.status === "connected";

      logger.info({ businessId, loggedOut }, "WhatsApp session closed");

      if (loggedOut) {
        const dir = getSessionDir(businessId);
        fs.rmSync(dir, { recursive: true, force: true });
        entry.status = "disconnected";
        await db
          .update(businessesTable)
          .set({ sessionStatus: "disconnected", connectedPhone: null, updatedAt: new Date() })
          .where(eq(businessesTable.id, businessId));
        broadcastToSSE(businessId, { type: "disconnected", reason: "logged_out" });
        sessions.delete(businessId);
      } else if (wasConnected) {
        // Session was live — auto-reconnect to restore service
        entry.status = "disconnected";
        await db
          .update(businessesTable)
          .set({ sessionStatus: "disconnected", updatedAt: new Date() })
          .where(eq(businessesTable.id, businessId));
        broadcastToSSE(businessId, { type: "reconnecting" });
        const timer = setTimeout(() => startSession(businessId), 5000);
        restartTimers.set(businessId, timer);
      } else {
        // Was still in QR-scan phase
        if (entry.connectAttempts >= 5) {
          // Too many failed attempts — stale credentials. Clear them and stop.
          const dir = getSessionDir(businessId);
          fs.rmSync(dir, { recursive: true, force: true });
          entry.status = "disconnected";
          await db
            .update(businessesTable)
            .set({ sessionStatus: "disconnected", connectedPhone: null, updatedAt: new Date() })
            .where(eq(businessesTable.id, businessId));
          broadcastToSSE(businessId, { type: "disconnected", reason: "auth_failed" });
          sessions.delete(businessId);
          logger.warn({ businessId }, "QR session failed too many times — cleared stale credentials");
        } else {
          // Retry so the QR panel can pick up a fresh QR code
          entry.status = "connecting";
          entry.qrDataUrl = null;
          broadcastToSSE(businessId, { type: "reconnecting" });
          const timer = setTimeout(() => startSession(businessId), 3000);
          restartTimers.set(businessId, timer);
        }
      }
    }

    if (connection === "open") {
      const jid = sock.user?.id ?? "";
      const phone = jid.split(":")[0].split("@")[0];
      entry.status = "connected";
      entry.connectedPhone = phone;
      entry.qrDataUrl = null;
      entry.connectAttempts = 0; // reset on success

      await db
        .update(businessesTable)
        .set({ sessionStatus: "connected", connectedPhone: phone, connectionType: "qr_session", updatedAt: new Date() })
        .where(eq(businessesTable.id, businessId));

      broadcastToSSE(businessId, { type: "connected", phone });
      logger.info({ businessId, phone }, "WhatsApp QR session connected");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // Diagnostic: log every upsert event so we can see what Baileys receives
    logger.info({ businessId, type, count: messages.length, jids: messages.map(m => m.key.remoteJid) }, "messages.upsert received");

    if (type !== "notify") return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      // Accept real 1-on-1 messages: standard @s.whatsapp.net and newer
      // privacy-preserving @lid JIDs. Skip groups (@g.us) and newsletters (@newsletter).
      if (!jid || (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@lid"))) continue;

      // Strip domain and optional multi-device suffix
      // e.g. "919140600553:5@s.whatsapp.net" → "919140600553"
      // e.g. "173237656879273@lid" → "173237656879273"
      const senderPhone = jid.split("@")[0].split(":")[0];
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        "";

      if (!text) continue;

      const pushName = msg.pushName ?? null;

      try {
        const business = await findBusinessByConnectedPhone(entry.connectedPhone ?? senderPhone);
        if (!business) {
          logger.warn({ businessId, senderPhone }, "No business found for connected phone");
          continue;
        }

        await handleIncomingMessage({
          business,
          customerPhone: senderPhone,
          customerName: pushName,
          messageText: text,
          sendReply: async (replyText) => {
            await sock.sendMessage(jid, { text: replyText });
          },
        });
      } catch (err) {
        logger.error({ err, businessId, senderPhone }, "Error handling incoming message");
      }
    }
  });
}

export async function stopSession(businessId: number): Promise<void> {
  clearRestartTimer(businessId);
  const entry = sessions.get(businessId);
  if (!entry) return;

  try {
    (entry.socket as { end?: () => void })?.end?.();
  } catch {
    // ignore
  }

  for (const client of entry.sseClients) {
    try {
      client.end();
    } catch {
      // ignore
    }
  }

  entry.sseClients.clear();
  sessions.delete(businessId);

  await db
    .update(businessesTable)
    .set({ sessionStatus: "disconnected", updatedAt: new Date() })
    .where(eq(businessesTable.id, businessId));
}

export function addSSEClient(businessId: number, res: Response): void {
  const entry = sessions.get(businessId);
  if (!entry) return;
  entry.sseClients.add(res);

  // Immediately send current state
  if (entry.status === "connected" && entry.connectedPhone) {
    res.write(`data: ${JSON.stringify({ type: "connected", phone: entry.connectedPhone })}\n\n`);
  } else if (entry.qrDataUrl) {
    res.write(`data: ${JSON.stringify({ type: "qr", qrDataUrl: entry.qrDataUrl })}\n\n`);
  }
}

export function removeSSEClient(businessId: number, res: Response): void {
  sessions.get(businessId)?.sseClients.delete(res);
}

export function getSessionStatus(businessId: number): { status: string; connectedPhone: string | null } {
  const entry = sessions.get(businessId);
  if (!entry) return { status: "no_session", connectedPhone: null };
  return { status: entry.status, connectedPhone: entry.connectedPhone };
}

export async function sendMessageViaSession(businessId: number, toPhone: string, text: string): Promise<void> {
  const entry = sessions.get(businessId);
  if (!entry || entry.status !== "connected") {
    throw new Error(`No active QR session for business ${businessId}`);
  }
  const sock = entry.socket as { sendMessage: (jid: string, content: { text: string }) => Promise<unknown> };
  const jid = `${toPhone}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text });
}

export async function restoreActiveSessions(): Promise<void> {
  try {
    const businesses = await db
      .select()
      .from(businessesTable)
      .where(eq(businessesTable.connectionType, "qr_session"));

    for (const biz of businesses) {
      const sessionDir = path.join(SESSIONS_DIR, String(biz.id));
      if (fs.existsSync(sessionDir) && fs.readdirSync(sessionDir).length > 0) {
        logger.info({ businessId: biz.id }, "Restoring WhatsApp session");
        startSession(biz.id).catch((err) => {
          logger.error({ err, businessId: biz.id }, "Failed to restore session");
        });
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to restore sessions on startup");
  }
}
