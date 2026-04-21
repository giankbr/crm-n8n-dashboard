import express from "express";
import {
  persistIncomingMessage,
  precheckThreadState,
  pauseAiForThread,
  setNonAi,
  clearThreadGuards
} from "./modules/chat/chat.service.js";
import { classifyIntent } from "./modules/intent/intent.service.js";
import {
  createBooking,
  getBookingById,
  getTodayBookings,
  processBookingForm,
  validateBookingWindow
} from "./modules/booking/booking.service.js";
import { createPickupRequest, parseAndValidatePickup, validatePickup } from "./modules/pickup/pickup.service.js";
import { resolveBranch } from "./modules/routing/routing.service.js";
import { buildKnowledgeReply, getServiceHistoryByPlate } from "./modules/knowledge/knowledge.service.js";
import { escalate, resolveEscalationsByThread } from "./modules/admin/admin.service.js";
import { sendText, getSessions, startSession, getSessionQR, createSession, healthCheck } from "./modules/waha/waha.service.js";
import { getGhostingLeads, markGhostingFollowupSent } from "./modules/lead/lead.service.js";
import { syncBookingToGoogleSheets } from "./modules/sheets/sheets.service.js";
import { pool } from "./db/pool.js";
import { config } from "./config.js";
import { loginDashboardUser } from "./modules/auth/auth.service.js";
import { requireAuth, requireRole } from "./middleware/auth.middleware.js";
import { normalizeChatId, normalizeWaNumber } from "./utils/wa-identity.js";

const router = express.Router();
const dashboardAuth = requireAuth();
const dashboardAdminOnly = [dashboardAuth, requireRole(["admin"])];

router.get("/health", (_req, res) => res.json({ ok: true }));

router.post("/auth/login", async (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (!username || !password) {
    return res.status(400).json({ error: "bad_request", message: "username and password are required" });
  }
  const result = await loginDashboardUser(username, password);
  if (!result) {
    return res.status(401).json({ error: "unauthorized", message: "Invalid credentials" });
  }
  return res.json(result);
});

router.get("/auth/me", dashboardAuth, async (req, res) => {
  res.json({ user: req.user });
});

router.post("/webhook/waha", async (req, res, next) => {
  try {
    const thread = await persistIncomingMessage(req.body);
    const traceId = String(req.body?.traceId || req.body?.body?.traceId || req.body?.messageId || "").trim();
    if (traceId) {
      console.log(`[trace:${traceId}] webhook persisted`, { threadId: thread.thread_id });
    }
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

router.post("/chat/pause", dashboardAuth, async (req, res, next) => {
  try {
    await pauseAiForThread(req.body.threadId);
    res.json({ updated: true });
  } catch (error) {
    next(error);
  }
});

router.post("/chat/non-ai", dashboardAuth, async (req, res, next) => {
  try {
    await setNonAi(req.body.threadId, Boolean(req.body.nonAi));
    res.json({ updated: true, nonAi: Boolean(req.body.nonAi) });
  } catch (error) {
    next(error);
  }
});

router.post("/chat/resolve-case", dashboardAuth, async (req, res, next) => {
  try {
    const threadId = String(req.body?.threadId || "").trim();
    if (!threadId) {
      return res.status(400).json({ error: "bad_request", message: "threadId is required" });
    }
    const notes = String(req.body?.notes || "").trim() || null;
    const guards = await clearThreadGuards(threadId);
    const escalations = await resolveEscalationsByThread(threadId, notes);
    res.json({
      updated: true,
      threadId,
      guards,
      escalations,
      policy: "auto_clear_non_ai_and_pause_on_case_resolution"
    });
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
    const booking = await getBookingById(result.bookingId);
    const sheets = await syncBookingToGoogleSheets(booking || result);
    res.json({ ...result, sheets });
  } catch (error) {
    next(error);
  }
});

router.post("/booking/process", async (req, res, next) => {
  try {
    const result = await processBookingForm({
      threadId: String(req.body?.threadId || "").trim(),
      text: String(req.body?.text || "")
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/booking/today", dashboardAuth, async (_req, res, next) => {
  try {
    const rows = await getTodayBookings();
    res.json({ bookings: rows });
  } catch (error) {
    next(error);
  }
});

router.get("/lead/ghosting/due", async (req, res, next) => {
  try {
    const rows = await getGhostingLeads({
      hours: Number(req.query.hours || 24),
      limit: Number(req.query.limit || 100)
    });
    res.json({ leads: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/lead/ghosting/mark-sent", async (req, res, next) => {
  try {
    const threadId = String(req.body?.threadId || "").trim();
    if (!threadId) {
      return res.status(400).json({ error: "bad_request", message: "threadId is required" });
    }
    const result = await markGhostingFollowupSent(threadId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/threads", dashboardAuth, async (_req, res, next) => {
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

router.get("/threads/:threadId/messages", dashboardAuth, async (req, res, next) => {
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

router.get("/threads/ghosted", dashboardAuth, async (_req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.thread_id, t.wa_number,
        m.body, m.sent_at AS last_incoming_at
      FROM threads t
      JOIN messages m ON m.thread_id = t.thread_id
        AND m.direction = 'incoming'
        AND m.sent_at = (
          SELECT MAX(m2.sent_at) FROM messages m2
          WHERE m2.thread_id = t.thread_id AND m2.direction = 'incoming'
        )
      WHERE t.status = 'active'
        AND t.non_ai = FALSE
        AND m.sent_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND NOT EXISTS (
          SELECT 1 FROM messages m3
          WHERE m3.thread_id = t.thread_id
          AND m3.direction = 'outgoing'
          AND m3.sent_at > m.sent_at
        )
      LIMIT 50`
    );
    res.json({ threads: rows });
  } catch (error) {
    next(error);
  }
});

router.post("/pickup/validate", async (req, res) => {
  const result = validatePickup(Number(req.body.distanceKm || 0));
  res.json(result);
});

router.post("/pickup/validate-text", async (req, res) => {
  const result = parseAndValidatePickup({
    text: req.body?.text || req.body?.body || "",
    distanceKm: req.body?.distanceKm
  });
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
    const userText = String(req.body?.userText || "").trim();
    if (!userText) return res.json(result);

    const knowledge = await buildKnowledgeReply({ text: userText, source: "fallback" });
    res.json({ ...result, reply: knowledge.reply, knowledgeRoute: knowledge.route, sources: knowledge.sources || [] });
  } catch (error) {
    next(error);
  }
});

router.get("/escalations", dashboardAuth, async (_req, res, next) => {
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

router.get("/workflow-rules", dashboardAdminOnly, async (_req, res, next) => {
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

router.put("/workflow-rules", dashboardAdminOnly, async (req, res, next) => {
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

router.get("/waha/sessions", dashboardAuth, async (_req, res, next) => {
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

router.post("/waha/sessions", dashboardAuth, async (req, res, next) => {
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

router.post("/waha/sessions/:session/start", dashboardAuth, async (req, res, next) => {
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

router.get("/waha/sessions/:session/qr", dashboardAuth, async (req, res, next) => {
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
    const chatIdRaw = String(req.body?.chatId || req.body?.to || req.body?.waNumber || "").trim();
    const text = String(req.body?.text || "").trim();
    const traceId = String(req.body?.traceId || "").trim();

    if (!chatIdRaw) {
      return res.status(400).json({
        error: "bad_request",
        message: "chatId, to, or waNumber is required"
      });
    }

    if (!text) {
      return res.status(400).json({
        error: "bad_request",
        message: "text is required"
      });
    }

    let destinationChatId = chatIdRaw;
    const waNumber = normalizeWaNumber(req.body?.waNumber || (!chatIdRaw.includes("@") ? chatIdRaw : ""));

    // Some WAHA accounts use @lid IDs. If caller only sends waNumber,
    // try resolving the latest known chatId from stored incoming metadata.
    if (!destinationChatId.includes("@") && waNumber) {
      const [rows] = await pool.query(
        `SELECT m.metadata
         FROM messages m
         INNER JOIN threads t ON t.thread_id = m.thread_id
         WHERE t.wa_number = ?
         ORDER BY m.sent_at DESC
         LIMIT 5`,
        [waNumber]
      );

      for (const row of rows) {
        const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
        const candidate = String(meta?.chatId || meta?.from || "").trim();
        if (candidate.includes("@")) {
          destinationChatId = candidate;
          break;
        }
      }
    }

    destinationChatId = normalizeChatId(destinationChatId);
    const result = await sendText(session, destinationChatId, text);
    if (traceId) {
      console.log(`[trace:${traceId}] send-text`, { session, destinationChatId });
    }
    res.json({ ok: true, traceId: traceId || null, ...result });
  } catch (error) {
    next(error);
  }
});

router.get("/trace/messages", dashboardAuth, async (req, res, next) => {
  try {
    const messageId = String(req.query?.messageId || "").trim();
    const traceId = String(req.query?.traceId || "").trim();
    if (!messageId && !traceId) {
      return res.status(400).json({ error: "bad_request", message: "messageId or traceId is required" });
    }
    const tracePattern = traceId ? `%${traceId}%` : null;
    const [rows] = await pool.query(
      `SELECT m.id, m.thread_id, t.wa_number, m.message_id, m.direction, m.body, m.metadata, m.sent_at
       FROM messages m
       INNER JOIN threads t ON t.thread_id = m.thread_id
       WHERE (? = '' OR m.message_id = ?)
         AND (? IS NULL OR CAST(m.metadata AS CHAR) LIKE ?)
       ORDER BY m.sent_at DESC, m.id DESC
       LIMIT 200`,
      [messageId, messageId, tracePattern, tracePattern]
    );
    res.json({
      query: { messageId: messageId || null, traceId: traceId || null },
      total: rows.length,
      traces: rows
    });
  } catch (error) {
    next(error);
  }
});

export default router;
