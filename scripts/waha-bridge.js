const WAHA_BASE_URL = process.env.WAHA_BASE_URL || "http://localhost:3000";
const WAHA_API_KEY = process.env.WAHA_API_KEY || "";
const WAHA_SESSION = process.env.WAHA_SESSION || "default";
const N8N_WEBHOOK_URL =
  process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/waha/incoming";
const POLL_MS = Number(process.env.WAHA_POLL_MS || 3000);

const seenMessageIds = new Set();

function authHeaders() {
  return WAHA_API_KEY ? { "X-Api-Key": WAHA_API_KEY } : {};
}

async function fetchChats() {
  const response = await fetch(`${WAHA_BASE_URL}/api/${WAHA_SESSION}/chats`, {
    headers: {
      ...authHeaders()
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`WAHA chats ${response.status}: ${text}`);
  }
  return response.json();
}

function normalizeIncoming(chat) {
  const msg = chat?.lastMessage;
  if (!msg || msg.fromMe) return null;
  const messageId = msg.id?._serialized || msg.id?.id || null;
  if (!messageId) return null;
  if (seenMessageIds.has(messageId)) return null;

  const rawFrom = msg.from || chat?.id?._serialized || "";
  const waNumber = String(rawFrom).replace(/@.+$/, "");
  const chatId = String(rawFrom || "");
  const body = String(msg.body || "").trim();
  if (!waNumber || !body) return null;

  return {
    waNumber,
    chatId,
    body,
    messageId,
    timestamp: new Date((msg.timestamp || Date.now() / 1000) * 1000).toISOString()
  };
}

async function forwardToN8n(payload) {
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`n8n webhook ${response.status}: ${text}`);
  }
  return text;
}

async function tick() {
  const chats = await fetchChats();
  const candidates = Array.isArray(chats) ? chats : [];
  for (const chat of candidates) {
    const incoming = normalizeIncoming(chat);
    if (!incoming) continue;
    await forwardToN8n(incoming);
    seenMessageIds.add(incoming.messageId);
    console.log("Forwarded:", incoming.waNumber, incoming.messageId);
  }
}

async function main() {
  console.log("WAHA bridge started");
  console.log("From:", `${WAHA_BASE_URL}/api/${WAHA_SESSION}/chats`);
  console.log("To  :", N8N_WEBHOOK_URL);
  setInterval(async () => {
    try {
      await tick();
    } catch (error) {
      console.error("Bridge error:", error.message);
    }
  }, POLL_MS);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
