import { config } from "../../config.js";
import { pool } from "../../db/pool.js";
import { getOrCreateThread, saveMessage, upsertCustomer } from "./chat.repository.js";

function extractIncomingMessage(rawPayload = {}) {
  const tryParseJson = (value) => {
    if (typeof value !== "string") return value;
    const text = value.trim();
    if (!text.startsWith("{") || !text.endsWith("}")) return value;
    try {
      return JSON.parse(text);
    } catch {
      return value;
    }
  };

  const normalizedRaw = tryParseJson(rawPayload);
  const payload =
    normalizedRaw?.body && typeof normalizedRaw.body === "object"
      ? normalizedRaw.body
      : normalizedRaw;

  const pickNested = (obj, keys, depth = 0) => {
    if (!obj || typeof obj !== "object" || depth > 4) return undefined;
    for (const key of keys) {
      const value = obj[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return value;
      }
    }
    for (const value of Object.values(obj)) {
      const parsed = tryParseJson(value);
      const nested = pickNested(parsed, keys, depth + 1);
      if (nested !== undefined) return nested;
    }
    return undefined;
  };

  const waNumberRaw = pickNested(payload, ["waNumber", "from", "fromNumber", "chatId", "phone"]);

  const waNumber = String(waNumberRaw || "").replace(/@.+$/, "").trim();
  if (!waNumber) {
    const error = new Error("Invalid webhook payload: waNumber/from/chatId is required");
    error.status = 400;
    throw error;
  }

  const messageBody = pickNested(payload, ["body", "text", "message"]) || "";
  const messageId = pickNested(payload, ["messageId", "id"]) || null;
  const customerName = pickNested(payload, ["name", "pushName"]) || null;
  const timestampRaw = pickNested(payload, ["timestamp", "time", "createdAt"]);
  const parsedTimestamp = timestampRaw ? new Date(timestampRaw) : new Date();
  const timestamp = Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp;

  return {
    waNumber,
    body: String(messageBody || ""),
    messageId,
    name: customerName,
    timestamp,
    metadata: payload
  };
}

export async function persistIncomingMessage(payload) {
  const normalized = extractIncomingMessage(payload);
  const waNumber = normalized.waNumber;
  const thread = await getOrCreateThread(waNumber);
  await upsertCustomer(waNumber, normalized.name || null);

  await saveMessage({
    threadId: thread.thread_id,
    messageId: normalized.messageId,
    direction: "incoming",
    body: normalized.body,
    metadata: normalized.metadata,
    sentAt: normalized.timestamp
  });

  return thread;
}

export async function precheckThreadState(waNumber) {
  // Check non_ai_list first (blocks even new threads)
  const [nonAiListRows] = await pool.query(
    `SELECT * FROM non_ai_list
     WHERE wa_number = ? AND active = TRUE
     AND (expires_at IS NULL OR expires_at > NOW())
     LIMIT 1`,
    [waNumber]
  );

  if (nonAiListRows.length > 0) {
    return { allowed: false, reason: "non_ai_list", nonAi: true, aiPausedUntil: null };
  }

  const [rows] = await pool.query(
    `SELECT thread_id, non_ai, ai_paused_until
     FROM threads
     WHERE wa_number = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [waNumber]
  );

  if (rows.length === 0) {
    return { allowed: true, reason: "new_thread", nonAi: false, aiPausedUntil: null };
  }

  const thread = rows[0];
  const now = new Date();
  const pauseUntil = thread.ai_paused_until ? new Date(thread.ai_paused_until) : null;
  const isPaused = pauseUntil && pauseUntil > now;

  if (thread.non_ai) {
    return { allowed: false, reason: "non_ai", nonAi: true, aiPausedUntil: pauseUntil };
  }
  if (isPaused) {
    return { allowed: false, reason: "human_active", nonAi: false, aiPausedUntil: pauseUntil };
  }

  return { allowed: true, reason: "ok", nonAi: false, aiPausedUntil: null };
}

export async function pauseAiForThread(threadId) {
  await pool.query(
    "UPDATE threads SET ai_paused_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE thread_id = ?",
    [config.aiPauseMinutes, threadId]
  );
}

export async function setNonAi(threadId, nonAi) {
  await pool.query("UPDATE threads SET non_ai = ? WHERE thread_id = ?", [nonAi ? 1 : 0, threadId]);
}
