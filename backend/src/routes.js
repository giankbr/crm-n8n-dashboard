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
import { pool } from "./db/pool.js";
import { config } from "./config.js";

const router = express.Router();

function getWahaAuthHeadersList(baseHeaders = {}) {
  const authStrategies = [];
  if (config.waha.apiKey) {
    authStrategies.push({ ...baseHeaders, "X-Api-Key": config.waha.apiKey });
  }
  if (config.waha.username && config.waha.password) {
    const auth = Buffer.from(`${config.waha.username}:${config.waha.password}`).toString("base64");
    authStrategies.push({ ...baseHeaders, Authorization: `Basic ${auth}` });
  }
  authStrategies.push(baseHeaders);
  return authStrategies;
}

async function wahaRequest(path, options = {}) {
  const baseHeaders = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const authStrategies = getWahaAuthHeadersList(baseHeaders);

  let lastStatus = 0;
  let lastBody = "";
  for (const headers of authStrategies) {
    const response = await fetch(`${config.waha.baseUrl}${path}`, {
      ...options,
      headers
    });
    const body = await response.text();
    if (response.ok) {
      return body ? JSON.parse(body) : {};
    }

    lastStatus = response.status;
    lastBody = body;
    if (response.status !== 401) break;
  }

  throw new Error(`WAHA ${lastStatus}: ${lastBody}`);
}

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

router.get("/waha/sessions", async (_req, res, next) => {
  try {
    const data = await wahaRequest("/api/sessions");
    const sessions = Array.isArray(data) ? data : data?.sessions || [];
    if (sessions.length > 0) {
      return res.json(sessions);
    }
    try {
      const fallback = await wahaRequest("/api/sessions/default");
      return res.json([fallback]);
    } catch {
      return res.json([]);
    }
  } catch (error) {
    if (String(error.message || "").includes("WAHA 401")) {
      return res.json({
        sessions: [],
        connected: false,
        authError: true,
        message: "WAHA unauthorized. Check WAHA auth env."
      });
    }
    next(error);
  }
});

router.post("/waha/sessions", async (req, res, next) => {
  try {
    const requestedName = String(req.body?.name || "").trim();
    if (requestedName && requestedName !== "default") {
      return res.status(400).json({
        error: "bad_request",
        message:
          "WAHA Core hanya mendukung 1 session bernama 'default'. Gunakan 'default' atau upgrade ke WAHA Plus untuk multi-session."
      });
    }

    const data = await wahaRequest("/api/sessions", {
      method: "POST",
      body: JSON.stringify(req.body)
    });

    res.json(data);
  } catch (error) {
    const message = String(error.message || "");
    if (message.includes("WAHA 422") && message.includes("already exists")) {
      return res.json({
        ok: true,
        alreadyExists: true,
        message: "Session 'default' sudah ada."
      });
    }
    next(error);
  }
});

router.post("/waha/sessions/:session/start", async (req, res, next) => {
  try {
    const data = await wahaRequest(`/api/sessions/${req.params.session}/start`, {
      method: "POST"
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

router.get("/waha/sessions/:session/qr", async (req, res, next) => {
  try {
    const session = req.params.session;
    const candidates = [
      { path: `/api/sessions/${session}/auth/qr`, method: "GET" },
      { path: `/api/${session}/auth/qr?format=image`, method: "GET", accept: "image/png" },
      { path: `/api/sessions/${session}/qr`, method: "GET" },
      { path: `/api/${session}/auth/qr`, method: "GET" },
      { path: `/api/sessions/${session}/auth/qr`, method: "POST" },
      { path: `/api/sessions/${session}/qr`, method: "POST" }
    ];

    let lastError;
    for (const candidate of candidates) {
      try {
        const baseHeaders = candidate.accept ? { Accept: candidate.accept } : {};
        const authHeadersList = getWahaAuthHeadersList(baseHeaders);
        for (const headers of authHeadersList) {
          const response = await fetch(`${config.waha.baseUrl}${candidate.path}`, {
            method: candidate.method,
            headers
          });
          const contentType = response.headers.get("content-type") || "";
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`WAHA ${response.status}: ${errorText}`);
          }
          if (contentType.includes("image/")) {
            const buffer = Buffer.from(await response.arrayBuffer());
            const base64 = buffer.toString("base64");
            return res.json({ base64, mimeType: contentType });
          }
          const text = await response.text();
          const data = text ? JSON.parse(text) : {};
          return res.json(data);
        }
      } catch (error) {
        lastError = error;
      }
    }

    const lastMessage = String(lastError?.message || "");
    if (lastMessage.includes("WAHA 404")) {
      return res.json({
        qrUnavailable: true,
        message:
          "QR endpoint tidak tersedia di versi WAHA ini. Gunakan WAHA dashboard untuk scan QR.",
        dashboardUrl: config.waha.dashboardUrl
      });
    }

    throw lastError || new Error("Failed to fetch WAHA QR");
  } catch (error) {
    next(error);
  }
});

router.post("/waha/send-text", async (req, res, next) => {
  try {
    const session = String(req.body?.session || "default").trim() || "default";
    const chatIdRaw = String(req.body?.chatId || req.body?.to || "").trim();
    const text = String(req.body?.text || "").trim();

    if (!chatIdRaw || !text) {
      return res.status(400).json({
        error: "bad_request",
        message: "chatId/to and text are required"
      });
    }

    const chatId = /@/.test(chatIdRaw) ? chatIdRaw : `${chatIdRaw}@c.us`;
    const data = await wahaRequest(`/api/sendText`, {
      method: "POST",
      body: JSON.stringify({
        session,
        chatId,
        text
      })
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

export default router;
