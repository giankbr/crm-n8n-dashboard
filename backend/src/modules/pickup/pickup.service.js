import { pool } from "../../db/pool.js";

export function parsePickupDistance(text = "", explicitDistanceKm = null) {
  const asNumber = (value) => {
    if (value === undefined || value === null || String(value).trim() === "") return NaN;
    return Number(String(value).replace(/,/g, ".").replace(/[^\d.]/g, ""));
  };

  const explicit = asNumber(explicitDistanceKm);
  if (Number.isFinite(explicit)) return explicit;

  const normalized = String(text || "").toLowerCase();
  const patterns = [
    /(?:jarak|distance|kurang lebih|sekitar)?\s*(\d+(?:[.,]\d+)?)\s*(?:km|kilometer|kilo)\b/i,
    /(?:jarak|distance)\s*(?:nya)?\s*(\d+(?:[.,]\d+)?)/i,
    /\b(\d+(?:[.,]\d+)?)\s*km\b/i
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) {
      const value = Number(String(match[1]).replace(",", "."));
      if (Number.isFinite(value)) return value;
    }
  }
  return 1.5;
}

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

export function parseAndValidatePickup({ text = "", distanceKm = null } = {}) {
  const parsedDistanceKm = parsePickupDistance(text, distanceKm);
  return validatePickup(parsedDistanceKm);
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
