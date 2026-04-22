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
  const resolvedPayload = await hydrateBookingPayloadFromDraft(payload || {});
  const normalizedScheduleAt = normalizeScheduleAt(resolvedPayload.scheduleAt);
  const [result] = await pool.query(
    `INSERT INTO bookings
      (customer_id, thread_id, vehicle, plate, service_type, schedule_at, branch_id, pickup_flag, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      resolvedPayload.customerId || null,
      resolvedPayload.threadId,
      resolvedPayload.vehicle,
      resolvedPayload.plate,
      resolvedPayload.serviceType || null,
      normalizedScheduleAt,
      resolvedPayload.branchId || null,
      resolvedPayload.pickupFlag ? 1 : 0
    ]
  );
  return { bookingId: result.insertId };
}

async function hydrateBookingPayloadFromDraft(payload = {}) {
  const base = { ...(payload || {}) };
  if (!base.threadId) return base;
  if (base.vehicle && base.plate && base.scheduleAt) return base;

  const [rows] = await pool.query(
    `SELECT vehicle, plate, schedule_at, service_type, pickup_flag
     FROM booking_drafts
     WHERE thread_id = ?
     LIMIT 1`,
    [base.threadId]
  );
  const draft = rows[0];
  if (!draft) return base;

  return {
    ...base,
    vehicle: base.vehicle || draft.vehicle || null,
    plate: base.plate || draft.plate || null,
    scheduleAt: base.scheduleAt || draft.schedule_at || null,
    serviceType: base.serviceType || draft.service_type || "servis berkala",
    pickupFlag:
      base.pickupFlag !== undefined && base.pickupFlag !== null ? Boolean(base.pickupFlag) : Boolean(draft.pickup_flag)
  };
}

function normalizeScheduleAt(value) {
  if (!value) {
    const err = new Error("scheduleAt is required");
    err.status = 400;
    throw err;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    const err = new Error("Invalid scheduleAt format");
    err.status = 400;
    throw err;
  }
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}:${pad(date.getSeconds())}`;
}

export async function getBookingById(bookingId) {
  const [rows] = await pool.query(
    `SELECT id, customer_id, thread_id, vehicle, plate, service_type, schedule_at, branch_id, pickup_flag, status, created_at
     FROM bookings
     WHERE id = ?
     LIMIT 1`,
    [bookingId]
  );
  return rows[0] || null;
}

export async function getTodayBookings() {
  const [rows] = await pool.query(
    `SELECT * FROM bookings
     WHERE DATE(schedule_at) = CURDATE()
     AND status IN ('pending', 'confirmed')`
  );
  return rows;
}

async function ensureBookingDraftsTable() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS booking_drafts (
      thread_id VARCHAR(50) PRIMARY KEY,
      customer_name VARCHAR(255) NULL,
      vehicle VARCHAR(255) NULL,
      plate VARCHAR(20) NULL,
      schedule_at DATETIME NULL,
      pickup_flag BOOLEAN NULL,
      service_type VARCHAR(100) NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  const [columnRows] = await pool.query(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'booking_drafts'
       AND COLUMN_NAME IN ('customer_name', 'pickup_flag')`
  );
  const existingColumns = new Set(columnRows.map((row) => row.COLUMN_NAME));
  if (!existingColumns.has("customer_name")) {
    await pool.query("ALTER TABLE booking_drafts ADD COLUMN customer_name VARCHAR(255) NULL");
  }
  if (!existingColumns.has("pickup_flag")) {
    await pool.query("ALTER TABLE booking_drafts ADD COLUMN pickup_flag BOOLEAN NULL");
  }
}

function extractPlate(text = "") {
  const match = String(text).toUpperCase().match(/\b([A-Z]{1,2}\s?\d{1,4}\s?[A-Z]{1,3})\b/);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
}

function extractVehicle(text = "") {
  const t = String(text).toLowerCase();
  const known = [
    "vario",
    "beat",
    "mio",
    "nmax",
    "aerox",
    "pcx",
    "cb150",
    "supra",
    "scoopy",
    "adv"
  ];
  const found = known.find((v) => t.includes(v));
  if (found) return found.toUpperCase();
  return /\b(motor|motor saya)\b/i.test(t) ? "MOTOR" : null;
}

function extractName(text = "") {
  const t = String(text || "").trim();
  const match = t.match(/\b(nama\s*(saya)?|saya)\s+([a-zA-Z][a-zA-Z\s'.-]{1,40})$/i);
  if (match) return String(match[3] || "").trim();

  // Accept simple direct name input (e.g. "gian") when user answers
  // booking name prompt without "nama saya ...".
  const simple = t.match(/^[a-zA-Z][a-zA-Z\s'.-]{1,40}$/);
  if (!simple) return null;

  const lowered = t.toLowerCase();
  const stopwords = new Set([
    "ya",
    "iya",
    "tidak",
    "gak",
    "ga",
    "no",
    "yes",
    "booking",
    "servis",
    "service",
    "pickup",
    "jemput"
  ]);
  if (stopwords.has(lowered)) return null;
  return t;
}

function extractPickupFlag(text = "") {
  const t = String(text || "").toLowerCase();
  if (/\b(pickup|jemput|antar[-\s]?jemput)\b/.test(t)) return true;
  if (/\b(tidak pickup|ga pickup|gak pickup|tanpa pickup|datang sendiri)\b/.test(t)) return false;
  if (/^\s*y\s*$/i.test(t)) return true;
  if (/^\s*n\s*$/i.test(t)) return false;
  if (/^\s*(ya|iya|yes)\s*$/.test(t)) return true;
  if (/^\s*(tidak|ga|gak|no|nggak)\s*$/.test(t)) return false;
  return null;
}

function extractSchedule(text = "", now = new Date()) {
  const t = String(text).toLowerCase();
  const hm = t.match(/\b(jam|pukul)\s*(\d{1,2})(?:[:.](\d{2}))?\b/);
  if (!hm) return null;

  const hour = Number(hm[2]);
  const minute = hm[3] ? Number(hm[3]) : 0;
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) return null;

  const target = new Date(now);
  if (/\bbesok\b/.test(t)) {
    target.setDate(target.getDate() + 1);
  } else if (/\blusa\b/.test(t)) {
    target.setDate(target.getDate() + 2);
  }
  target.setHours(hour, minute, 0, 0);
  return target;
}

function nextMissingField(draft) {
  if (!draft.customerName) return "name";
  if (!draft.plate) return "plate";
  if (!draft.vehicle) return "vehicle";
  if (!draft.scheduleAt) return "schedule";
  if (draft.pickupFlag === null || draft.pickupFlag === undefined) return "pickup";
  return null;
}

function questionForMissing(field) {
  if (field === "name") return "Siap, sebelum booking lanjut boleh info nama kamu dulu ya?";
  if (field === "plate") return "Oke, lanjut ya. Kabarin nopol motornya dulu (contoh: AD 1234 AB).";
  if (field === "vehicle") return "Sip. Jenis motornya apa ya? (contoh: Vario 125 / Beat / NMAX)";
  if (field === "schedule") return "Siap, maunya dijadwalkan kapan? Contoh: besok jam 10.";
  if (field === "pickup") return "Perlu layanan pickup motor juga? Balas aja: ya / tidak.";
  return "Boleh, kita lengkapi data bookingnya dulu ya.";
}

export async function processBookingForm({ threadId, text }) {
  if (!threadId) {
    const err = new Error("threadId is required");
    err.status = 400;
    throw err;
  }

  await ensureBookingDraftsTable();

  const [rows] = await pool.query(
    `SELECT thread_id, customer_name, vehicle, plate, schedule_at, pickup_flag, service_type
     FROM booking_drafts
     WHERE thread_id = ?
     LIMIT 1`,
    [threadId]
  );

  const existing = rows[0] || {};
  const extractedPlate = extractPlate(text);
  const extractedVehicle = extractVehicle(text);
  const extractedSchedule = extractSchedule(text);
  const extractedName = extractName(text);
  const extractedPickupFlag = extractPickupFlag(text);

  const draft = {
    customerName: extractedName || existing.customer_name || null,
    plate: extractedPlate || existing.plate || null,
    vehicle: extractedVehicle || existing.vehicle || null,
    scheduleAt: extractedSchedule || (existing.schedule_at ? new Date(existing.schedule_at) : null),
    pickupFlag:
      extractedPickupFlag !== null && extractedPickupFlag !== undefined
        ? extractedPickupFlag
        : existing.pickup_flag === null || existing.pickup_flag === undefined
          ? null
          : Boolean(existing.pickup_flag),
    serviceType: existing.service_type || "servis berkala"
  };

  await pool.query(
    `INSERT INTO booking_drafts (thread_id, customer_name, vehicle, plate, schedule_at, pickup_flag, service_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       customer_name = VALUES(customer_name),
       vehicle = VALUES(vehicle),
       plate = VALUES(plate),
       schedule_at = VALUES(schedule_at),
       pickup_flag = VALUES(pickup_flag),
       service_type = VALUES(service_type)`,
    [
      threadId,
      draft.customerName,
      draft.vehicle,
      draft.plate,
      draft.scheduleAt ? normalizeScheduleAt(draft.scheduleAt) : null,
      draft.pickupFlag === null || draft.pickupFlag === undefined ? null : (draft.pickupFlag ? 1 : 0),
      draft.serviceType
    ]
  );

  const missing = nextMissingField(draft);
  if (missing) {
    return {
      completed: false,
      reply: questionForMissing(missing),
      missing
    };
  }

  const validation = validateBookingWindow(draft.scheduleAt);
  if (!validation.valid) {
    return {
      completed: false,
      reply: "Jadwalnya agak mepet ke jam tutup nih. Boleh pilih jam lain ya, misalnya besok jam 10.",
      missing: "schedule"
    };
  }

  await pool.query("DELETE FROM booking_drafts WHERE thread_id = ?", [threadId]);

  return {
    completed: true,
    bookingPayload: {
      threadId,
      vehicle: draft.vehicle,
      plate: draft.plate,
      serviceType: draft.serviceType,
      scheduleAt: normalizeScheduleAt(draft.scheduleAt),
      pickupFlag: Boolean(draft.pickupFlag),
      notes: `Nama customer: ${draft.customerName}`
    }
  };
}
