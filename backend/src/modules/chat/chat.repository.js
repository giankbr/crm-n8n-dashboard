import { pool } from "../../db/pool.js";

export async function getOrCreateThread(waNumber) {
  const threadId = `thr_${waNumber.replace(/[^\d]/g, "")}`;
  const [rows] = await pool.query("SELECT * FROM threads WHERE thread_id = ?", [threadId]);
  if (rows.length > 0) return rows[0];

  await pool.query(
    "INSERT INTO threads (thread_id, wa_number, status, non_ai) VALUES (?, ?, 'active', FALSE)",
    [threadId, waNumber]
  );

  const [created] = await pool.query("SELECT * FROM threads WHERE thread_id = ?", [threadId]);
  return created[0];
}

export async function saveMessage({ threadId, messageId, direction, body, metadata, sentAt }) {
  await pool.query(
    `INSERT INTO messages (thread_id, message_id, direction, body, metadata, sent_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [threadId, messageId || null, direction, body || "", JSON.stringify(metadata || {}), sentAt]
  );
}

export async function updateAiPause(threadId, minutes) {
  await pool.query(
    "UPDATE threads SET ai_paused_until = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE thread_id = ?",
    [minutes, threadId]
  );
}

export async function upsertCustomer(waNumber, name = null) {
  await pool.query(
    `INSERT INTO customers (wa_number, name)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE name = COALESCE(VALUES(name), name)`,
    [waNumber, name]
  );
}
