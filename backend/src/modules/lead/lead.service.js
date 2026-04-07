import { pool } from "../../db/pool.js";
import { config } from "../../config.js";

export async function getGhostingLeads({ hours = config.ghosting.hours, limit = config.ghosting.limit } = {}) {
  const safeHours = Number.isFinite(Number(hours)) ? Number(hours) : config.ghosting.hours;
  const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : config.ghosting.limit;

  const [rows] = await pool.query(
    `SELECT
      t.thread_id,
      t.wa_number,
      MAX(CASE WHEN m.direction = 'incoming' THEN m.sent_at END) AS last_incoming_at,
      MAX(CASE WHEN m.direction = 'outgoing' THEN m.sent_at END) AS last_outgoing_at
    FROM threads t
    JOIN messages m ON m.thread_id = t.thread_id
    WHERE t.status = 'active'
      AND t.non_ai = FALSE
      AND COALESCE(t.lead_status, 'open') <> 'followup_sent'
      AND (t.ai_paused_until IS NULL OR t.ai_paused_until < NOW())
    GROUP BY t.thread_id, t.wa_number
    HAVING last_incoming_at IS NOT NULL
      AND TIMESTAMPDIFF(HOUR, last_incoming_at, NOW()) >= ?
      AND (last_outgoing_at IS NULL OR last_outgoing_at < last_incoming_at)
    ORDER BY last_incoming_at ASC
    LIMIT ?`,
    [safeHours, safeLimit]
  );

  return rows;
}

export async function markGhostingFollowupSent(threadId) {
  await pool.query(`UPDATE threads SET lead_status = 'followup_sent' WHERE thread_id = ?`, [threadId]);
  return { updated: true, threadId };
}
