import { extractIdentityFromIncoming } from "./wa-identity.js";

const WAHA_BASE_URL = process.env.WAHA_BASE_URL || "http://localhost:3000";
const WAHA_API_KEY = process.env.WAHA_API_KEY || "";
const WAHA_SESSION = process.env.WAHA_SESSION || "default";
const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/waha/incoming";
const POLL_MS = Number(process.env.WAHA_POLL_MS || 3000);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const seenMessageIds = new Set();
const seenPayloadSignatures = new Map();

// Stats tracking
const stats = {
  startedAt: new Date(),
  messagesProcessed: 0,
  messagesForwarded: 0,
  errors: 0,
  lastError: null
};

function log(level, msg, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  if (data) {
    console.log(`${prefix} ${msg}`, data);
  } else {
    console.log(`${prefix} ${msg}`);
  }
}

function authHeaders() {
  return WAHA_API_KEY ? { "X-Api-Key": WAHA_API_KEY } : {};
}

async function fetchChats(attempt = 1) {
  try {
    const response = await fetch(`${WAHA_BASE_URL}/api/${WAHA_SESSION}/chats`, {
      headers: authHeaders(),
      timeout: 10000
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`WAHA chats ${response.status}: ${text}`);
    }

    return await response.json();
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      log("warn", `Fetch chats attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms`, error.message);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return fetchChats(attempt + 1);
    }
    throw error;
  }
}

function normalizeIncoming(chat) {
  const msg = chat?.lastMessage;
  if (!msg || msg.fromMe) return null;
  const messageId = msg.id?._serialized || msg.id?.id || null;
  if (!messageId) return null;
  if (seenMessageIds.has(messageId)) return null;

  const { chatId, waNumber } = extractIdentityFromIncoming({
    chatId: chat?.id?._serialized,
    from: msg.from
  });
  const body = String(msg.body || "").trim();
  if (!waNumber || !body) return null;
  const msgTs = Number(msg.timestamp || 0);
  const signature = `${waNumber}|${body.toLowerCase()}|${msgTs}`;
  if (seenPayloadSignatures.has(signature)) return null;
  const traceId = `wa-${messageId}`;

  return {
    waNumber,
    chatId,
    body,
    messageId,
    signature,
    traceId,
    timestamp: new Date((msg.timestamp || Date.now() / 1000) * 1000).toISOString()
  };
}

async function forwardToN8n(payload, attempt = 1) {
  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      timeout: 10000
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`n8n webhook ${response.status}: ${text}`);
    }

    stats.messagesForwarded++;
    return text;
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      log("warn", `Forward to n8n attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms`, error.message);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      return forwardToN8n(payload, attempt + 1);
    }
    throw error;
  }
}

async function tick() {
  try {
    const chats = await fetchChats();
    const candidates = Array.isArray(chats) ? chats : [];

    for (const chat of candidates) {
      const incoming = normalizeIncoming(chat);
      if (!incoming) continue;

      stats.messagesProcessed++;
      await forwardToN8n(incoming);
      seenMessageIds.add(incoming.messageId);
      seenPayloadSignatures.set(incoming.signature, Date.now());
      if (seenPayloadSignatures.size > 5000) {
        const now = Date.now();
        for (const [key, ts] of seenPayloadSignatures.entries()) {
          if (now - ts > 30 * 60 * 1000) seenPayloadSignatures.delete(key);
        }
      }
      log("info", "Forwarded message", {
        traceId: incoming.traceId,
        from: incoming.waNumber,
        messageId: incoming.messageId,
        timestamp: incoming.timestamp
      });
    }
  } catch (error) {
    stats.errors++;
    stats.lastError = error.message;
    log("error", "Tick error", error.message);
  }
}

function getStats() {
  const uptime = Math.floor((new Date() - stats.startedAt) / 1000);
  return {
    ...stats,
    uptime: `${uptime}s`,
    seenMessageCount: seenMessageIds.size
  };
}

async function main() {
  log("info", "=== WAHA Bridge Started ===");
  log("info", "Configuration", {
    from: `${WAHA_BASE_URL}/api/${WAHA_SESSION}/chats`,
    to: N8N_WEBHOOK_URL,
    pollInterval: `${POLL_MS}ms`,
    apiKey: WAHA_API_KEY ? "set" : "not set"
  });

  // Initial tick
  await tick();

  // Polling loop
  const intervalId = setInterval(async () => {
    await tick();
  }, POLL_MS);

  // Graceful shutdown
  process.on("SIGTERM", () => {
    log("info", "Received SIGTERM, shutting down gracefully");
    clearInterval(intervalId);
    log("info", "Final stats", getStats());
    process.exit(0);
  });

  process.on("SIGINT", () => {
    log("info", "Received SIGINT, shutting down gracefully");
    clearInterval(intervalId);
    log("info", "Final stats", getStats());
    process.exit(0);
  });

  // Log stats periodically
  setInterval(() => {
    log("debug", "Bridge stats", getStats());
  }, 60000); // Every minute
}

main().catch((error) => {
  log("error", "Fatal error", error.message);
  process.exit(1);
});
