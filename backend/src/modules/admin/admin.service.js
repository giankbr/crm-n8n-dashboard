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
