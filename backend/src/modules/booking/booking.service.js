import { pool } from "../../db/pool.js";

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function validateBookingWindow(scheduleAt, branchCloseHour = "17:00", weekendCloseHour = "16:00") {
  const target = new Date(scheduleAt);
  const closeHour = isWeekend(target) ? weekendCloseHour : branchCloseHour;
  const [h, m] = closeHour.split(":").map(Number);
  const closeTime = new Date(target);
  closeTime.setHours(h, m, 0, 0);

  const minLeadMinutes = isWeekend(target) ? 120 : 60;
  const diff = (closeTime.getTime() - target.getTime()) / 60000;
  const valid = diff >= minLeadMinutes;
  return {
    valid,
    reason: valid ? "ok" : "cutoff_exceeded",
    nextAction: valid ? "confirm_booking" : "offer_alternate_schedule"
  };
}

export async function createBooking(payload) {
  const [result] = await pool.query(
    `INSERT INTO bookings
      (customer_id, thread_id, vehicle, plate, service_type, schedule_at, branch_id, pickup_flag, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      payload.customerId || null,
      payload.threadId,
      payload.vehicle,
      payload.plate,
      payload.serviceType || null,
      payload.scheduleAt,
      payload.branchId || null,
      payload.pickupFlag ? 1 : 0
    ]
  );
  return { bookingId: result.insertId };
}

export async function getTodayBookings() {
  const [rows] = await pool.query(
    `SELECT * FROM bookings
     WHERE DATE(schedule_at) = CURDATE()
     AND status IN ('pending', 'confirmed')`
  );
  return rows;
}
