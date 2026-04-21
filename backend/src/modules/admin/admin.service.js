import { pool } from "../../db/pool.js";

export async function escalate({ threadId, type, targetRole, reason }) {
  const [result] = await pool.query(
    `INSERT INTO escalations (thread_id, type, target_role, reason, status)
     VALUES (?, ?, ?, ?, 'open')`,
    [threadId, type, targetRole, reason || null]
  );

  return {
    escalationId: result.insertId,
    status: "open"
  };
}

export async function resolveEscalationsByThread(threadId, notes = null) {
  try {
    const [result] = await pool.query(
      `UPDATE escalations
       SET status = 'resolved',
           notes = COALESCE(?, notes),
           resolved_at = NOW()
       WHERE thread_id = ?
         AND status IN ('open', 'in_progress')`,
      [notes, threadId]
    );
    return { updated: result.affectedRows };
  } catch {
    const [fallback] = await pool.query(
      `UPDATE escalations
       SET status = 'resolved'
       WHERE thread_id = ?
         AND status IN ('open', 'in_progress')`,
      [threadId]
    );
    return { updated: fallback.affectedRows };
  }
}
