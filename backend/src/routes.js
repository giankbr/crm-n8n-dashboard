import express from "express";
import {
  persistIncomingMessage,
  precheckThreadState,
  pauseAiForThread,
  setNonAi
} from "./modules/chat/chat.service.js";
import { classifyIntent } from "./modules/intent/intent.service.js";
import { createBooking, getTodayBookings, validateBookingWindow } from "./modules/booking/booking.service.js";
import { createPickupRequest, validatePickup } from "./modules/pickup/pickup.service.js";
import { resolveBranch } from "./modules/routing/routing.service.js";
import { buildKnowledgeReply, getServiceHistoryByPlate } from "./modules/knowledge/knowledge.service.js";
import { escalate } from "./modules/admin/admin.service.js";
import { sendText, getSessions, startSession, getSessionQR, createSession, healthCheck } from "./modules/waha/waha.service.js";
import { pool } from "./db/pool.js";
import { config } from "./config.js";

const router = express.Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

router.post("/webhook/waha", async (req, res, next) => {
  try {
    const thread = await persistIncomingMessage(req.body);
    res.json({ threadId: thread.thread_id, stored: true });
  } catch (error) {
    next(error);
  }
});

router.post("/chat/precheck", async (req, res, next) => {
  try {
    const result = await precheckThreadState(req.body.waNumber);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/chat/pause", async (req, res, next) => {
  try {
    await pauseAiForThread(req.body.threadId);
    res.json({ updated: true });
  } catch (error) {
    next(error);
  }
});

router.post("/chat/non-ai", async (req, res, next) => {
  try {
    await setNonAi(req.body.threadId, Boolean(req.body.nonAi));
    res.json({ updated: true, nonAi: Boolean(req.body.nonAi) });
  } catch (error) {
    next(error);
  }
});

router.post("/chat/classify", async (req, res, next) => {
  try {
    const result = await classifyIntent(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/booking/validate", async (req, res) => {
  const result = validateBookingWindow(req.body.scheduleAt, req.body.branchCloseHour, req.body.weekendCloseHour);
  res.json(result);
});

router.post("/booking/create", async (req, res, next) => {
  try {
    const result = await createBooking(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/booking/today", async (_req, res, next) => {
  try {
    const rows = await getTodayBookings();
    res.json({ bookings: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/threads", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        t.thread_id,
        t.wa_number,
        t.status,
        t.non_ai,
        t.ai_paused_until,
        t.updated_at,
        m.body AS last_message,
        m.sent_at AS last_message_at
      FROM threads t
      LEFT JOIN messages m
        ON m.id = (
          SELECT m2.id
          FROM messages m2
          WHERE m2.thread_id = t.thread_id
          ORDER BY m2.sent_at DESC, m2.id DESC
          LIMIT 1
        )
      ORDER BY t.updated_at DESC`
    );
    res.json({ threads: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/threads/:threadId/messages", async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, thread_id, direction, body, metadata, sent_at
       FROM messages
       WHERE thread_id = ?
       ORDER BY sent_at ASC, id ASC`,
      [req.params.threadId]
    );
    res.json({ messages: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/pickup/validate", async (req, res) => {
  const result = validatePickup(Number(req.body.distanceKm || 0));
  res.json(result);
});

router.post("/pickup/create", async (req, res, next) => {
  try {
    const result = await createPickupRequest(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/routing/resolve-branch", async (req, res, next) => {
  try {
    const result = await resolveBranch(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/history/:plateNo", async (req, res, next) => {
  try {
    const history = await getServiceHistoryByPlate(req.params.plateNo);
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

router.post("/knowledge/reply", async (req, res, next) => {
  try {
    const result = await buildKnowledgeReply(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/handover/escalate", async (req, res, next) => {
  try {
    const result = await escalate(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/escalations", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, thread_id, type, target_role, reason, status, created_at
       FROM escalations
       ORDER BY created_at DESC
       LIMIT 200`
    );
    res.json({ escalations: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/workflow-rules", async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT rule_key, enabled
       FROM workflow_rules
       ORDER BY rule_key ASC`
    );
    const rules = rows.reduce((acc, row) => {
      acc[row.rule_key] = Boolean(row.enabled);
      return acc;
    }, {});
    res.json({ rules });
  } catch (error) {
    next(error);
  }
});

router.put("/workflow-rules", async (req, res, next) => {
  try {
    const input = req.body?.rules || {};
    const entries = Object.entries(input).filter(([k]) => typeof k === "string");
    if (entries.length === 0) {
      return res.status(400).json({ error: "bad_request", message: "rules payload is required" });
    }

    for (const [ruleKey, enabled] of entries) {
      await pool.query(
        `INSERT INTO workflow_rules (rule_key, enabled)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
        [ruleKey, Boolean(enabled)]
      );
    }

    const [rows] = await pool.query(
      `SELECT rule_key, enabled
       FROM workflow_rules
       ORDER BY rule_key ASC`
    );
    const rules = rows.reduce((acc, row) => {
      acc[row.rule_key] = Boolean(row.enabled);
      return acc;
    }, {});
    res.json({ updated: true, rules });
  } catch (error) {
    next(error);
  }
});

router.get("/waha/sessions", async (_req, res, next) => {
  try {
    const sessions = await getSessions();
    res.json(sessions);
  } catch (error) {
    if (error.message.includes("401") || error.message.includes("unauthorized")) {
      return res.json({
        error: "waha_unauthorized",
        message: "WAHA unauthorized. Check WAHA credentials in .env",
        sessions: []
      });
    }
    next(error);
  }
});

router.post("/waha/sessions", async (req, res, next) => {
  try {
    const requestedName = String(req.body?.name || "").trim() || "default";

    // WAHA Core only supports single 'default' session
    if (requestedName !== "default") {
      return res.status(400).json({
        error: "bad_request",
        message: "WAHA Core only supports 'default' session. Use 'default' or upgrade to WAHA Plus for multi-session support."
      });
    }

    const result = await createSession({ name: requestedName, start: req.body?.start ?? true });
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.post("/waha/sessions/:session/start", async (req, res, next) => {
  try {
    const session = req.params.session;
    if (!session) {
      return res.status(400).json({
        error: "bad_request",
        message: "session name is required"
      });
    }
    const result = await startSession(session);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

router.get("/waha/sessions/:session/qr", async (req, res, next) => {
  try {
    const session = req.params.session;
    if (!session) {
      return res.status(400).json({
        error: "bad_request",
        message: "session name is required"
      });
    }

    try {
      const qrData = await getSessionQR(session);
      res.json(qrData);
    } catch (error) {
      // QR not available, provide dashboard link
      res.json({
        qrUnavailable: true,
        message: "QR endpoint tidak tersedia di versi WAHA ini. Gunakan WAHA dashboard untuk scan QR.",
        dashboardUrl: config.waha.dashboardUrl
      });
    }
  } catch (error) {
    next(error);
  }
});

router.post("/waha/send-text", async (req, res, next) => {
  try {
    const session = String(req.body?.session || "default").trim() || "default";
    const chatIdRaw = String(req.body?.chatId || req.body?.to || "").trim();
    const text = String(req.body?.text || "").trim();

    if (!chatIdRaw) {
      return res.status(400).json({
        error: "bad_request",
        message: "chatId (or 'to') is required"
      });
    }

    if (!text) {
      return res.status(400).json({
        error: "bad_request",
        message: "text is required"
      });
    }

    const result = await sendText(session, chatIdRaw, text);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

export default router;
