import { config } from "../../config.js";

function getWahaAuthHeaders() {
  const headers = {
    "Content-Type": "application/json"
  };

  if (config.waha.apiKey) {
    headers["X-Api-Key"] = config.waha.apiKey;
  } else if (config.waha.username && config.waha.password) {
    const auth = Buffer.from(`${config.waha.username}:${config.waha.password}`).toString("base64");
    headers["Authorization"] = `Basic ${auth}`;
  }

  return headers;
}

async function wahaRequest(path, options = {}) {
  const url = `${config.waha.baseUrl}${path}`;
  const headers = { ...getWahaAuthHeaders(), ...(options.headers || {}) };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const text = await response.text();
    const body = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(`WAHA ${response.status}: ${text || "Unknown error"}`);
    }

    return body;
  } catch (error) {
    throw new Error(`WAHA request failed: ${error.message}`);
  }
}

/**
 * Send text message via WAHA
 * @param {string} session - WAHA session name (e.g., 'default')
 * @param {string} chatId - WhatsApp chat ID (with or without @c.us)
 * @param {string} text - Message text
 * @returns {Promise<Object>} WAHA response
 */
export async function sendText(session, chatId, text) {
  if (!chatId || !text) {
    throw new Error("chatId and text are required");
  }

  const normalizedChatId = String(chatId).includes("@") ? chatId : `${chatId}@c.us`;

  try {
    // Try multiple WAHA API endpoints for compatibility
    const endpoints = [
      { path: `/api/sendText`, body: { session, chatId: normalizedChatId, text } },
      { path: `/api/${session}/sendText`, body: { chatId: normalizedChatId, text } },
      { path: `/api/${session}/messages/text`, body: { chatId: normalizedChatId, text } }
    ];

    let lastError;
    for (const endpoint of endpoints) {
      try {
        const result = await wahaRequest(endpoint.path, {
          method: "POST",
          body: JSON.stringify(endpoint.body)
        });
        return result;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  } catch (error) {
    throw new Error(`Failed to send message: ${error.message}`);
  }
}

/**
 * Get WAHA sessions
 * @returns {Promise<Array>} List of sessions
 */
export async function getSessions() {
  try {
    const data = await wahaRequest("/api/sessions");
    const sessions = Array.isArray(data) ? data : data?.sessions || [];

    if (sessions.length === 0) {
      // Try fallback for single session
      try {
        const fallback = await wahaRequest("/api/sessions/default");
        return [fallback];
      } catch {
        return [];
      }
    }

    return sessions;
  } catch (error) {
    if (error.message.includes("401")) {
      throw new Error("WAHA unauthorized. Check WAHA credentials in .env");
    }
    throw error;
  }
}

/**
 * Start WAHA session
 * @param {string} session - Session name
 * @returns {Promise<Object>} Start response
 */
export async function startSession(session) {
  return wahaRequest(`/api/sessions/${session}/start`, {
    method: "POST"
  });
}

/**
 * Get QR code for session
 * @param {string} session - Session name
 * @returns {Promise<Object>} QR code response
 */
export async function getSessionQR(session) {
  // Try multiple QR endpoint formats
  const candidates = [
    `/api/sessions/${session}/auth/qr`,
    `/api/${session}/auth/qr`,
    `/api/sessions/${session}/qr`
  ];

  let lastError;
  for (const path of candidates) {
    try {
      const url = `${config.waha.baseUrl}${path}`;
      const response = await fetch(url, {
        method: "GET",
        headers: getWahaAuthHeaders()
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`WAHA ${response.status}: ${errorText || "Unknown error"}`);
      }

      const contentType = String(response.headers.get("content-type") || "").toLowerCase();

      // Some WAHA versions return raw PNG bytes for QR.
      if (contentType.includes("image/")) {
        const buffer = Buffer.from(await response.arrayBuffer());
        return {
          base64: buffer.toString("base64"),
          mimeType: contentType.split(";")[0]
        };
      }

      // Other WAHA versions return JSON payload with qr/base64 keys.
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("QR endpoint not available");
}

/**
 * Create a new WAHA session
 * @param {Object} sessionData - Session configuration { name, start, etc }
 * @returns {Promise<Object>} Creation response
 */
export async function createSession(sessionData) {
  try {
    const result = await wahaRequest("/api/sessions", {
      method: "POST",
      body: JSON.stringify(sessionData)
    });
    return result;
  } catch (error) {
    if (error.message.includes("422") && error.message.includes("already exists")) {
      return {
        ok: true,
        alreadyExists: true,
        message: "Session already exists"
      };
    }
    throw error;
  }
}

/**
 * Health check WAHA connection
 * @returns {Promise<boolean>} True if connected
 */
export async function healthCheck() {
  try {
    const sessions = await getSessions();
    return sessions.length > 0;
  } catch {
    return false;
  }
}
