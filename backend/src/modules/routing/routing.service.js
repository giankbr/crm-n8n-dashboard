import { pool } from "../../db/pool.js";

function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function resolveBranch(payload) {
  const [branches] = await pool.query("SELECT id, name, latitude, longitude, active FROM branches WHERE active = TRUE");
  if (branches.length === 0) {
    return { transferAllowed: false, reason: "no_active_branch" };
  }

  if (!payload.customerLat || !payload.customerLng) {
    return { transferAllowed: false, reason: "missing_location" };
  }

  let nearest = null;
  for (const branch of branches) {
    if (branch.latitude == null || branch.longitude == null) continue;
    const km = haversineKm(payload.customerLat, payload.customerLng, Number(branch.latitude), Number(branch.longitude));
    if (!nearest || km < nearest.distanceKm) nearest = { ...branch, distanceKm: km };
  }
  if (!nearest) return { transferAllowed: false, reason: "branch_coordinate_missing" };

  return {
    sourceBranch: payload.sourceBranch || null,
    targetBranch: nearest.name,
    transferAllowed: true,
    reason: "ok",
    distanceKm: Number(nearest.distanceKm.toFixed(2))
  };
}
