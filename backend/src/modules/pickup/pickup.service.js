import { pool } from "../../db/pool.js";

export function validatePickup(distanceKm) {
  const inRange = distanceKm <= 7;
  const requireHumanValidation = distanceKm > 2 && inRange;
  const estCost = requireHumanValidation ? distanceKm * 5000 : 0;

  return {
    inRange,
    distanceKm,
    requireHumanValidation,
    estCost,
    reason: inRange ? "ok" : "out_of_range"
  };
}

export async function createPickupRequest(payload) {
  const [result] = await pool.query(
    `INSERT INTO pickup_requests
      (booking_id, thread_id, distance_km, est_cost, requires_human_validation, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      payload.bookingId || null,
      payload.threadId,
      payload.distanceKm,
      payload.estCost || 0,
      payload.requireHumanValidation ? 1 : 0,
      payload.status || "pending"
    ]
  );
  return { pickupRequestId: result.insertId };
}
