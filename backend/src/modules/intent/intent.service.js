import { pool } from "../../db/pool.js";

const rules = [
  { intent: "komplain", subflow: "G", patterns: [/komplain/i, /kecewa/i, /buruk/i, /marah/i] },
  { intent: "booking_servis", subflow: "A", patterns: [/booking/i, /servis/i, /service/i, /jadwal/i] },
  { intent: "jemput_kendaraan", subflow: "B", patterns: [/jemput/i, /antar/i, /pickup/i] },
  { intent: "routing_cabang", subflow: "F", patterns: [/cabang/i, /terdekat/i, /pindah cabang/i] },
  { intent: "history_nopol", subflow: "D", patterns: [/nopol/i, /plat/i, /riwayat/i] },
  { intent: "faq_waktu", subflow: "C", patterns: [/jam buka/i, /buka jam/i, /tutup jam/i, /libur/i] },
  { intent: "konsultasi", subflow: "E", patterns: [/oli/i, /rekomendasi/i, /gejala/i, /harga/i] }
];

function hasBookingSignal(text = "") {
  const normalized = String(text || "").toLowerCase();
  const hasBookingWord = /\b(booking|book|jadwal|reservasi|reserve)\b/i.test(normalized);
  const hasServiceWord = /\b(servis|service)\b/i.test(normalized);
  const hasTimeHint =
    /\b(jam|pukul|besok|lusa|hari ini|senin|selasa|rabu|kamis|jumat|sabtu|minggu|tanggal)\b/i.test(normalized) ||
    /\b\d{1,2}[:.]\d{2}\b/.test(normalized);

  if (hasServiceWord && !hasBookingWord && !hasTimeHint) return false;
  return hasBookingWord || (hasServiceWord && hasTimeHint);
}

export async function classifyIntent({ threadId, text, metadata }) {
  const resolvedThreadId = resolveThreadId(threadId, metadata);
  const code = metadata?.broadcastCode;
  let classification = { intent: "fallback_admin", subflow: "H", confidence: 0.4 };

  if (resolvedThreadId) {
    const [draftRows] = await pool.query(
      `SELECT thread_id
       FROM booking_drafts
       WHERE thread_id = ?
       LIMIT 1`,
      [resolvedThreadId]
    );
    if (draftRows.length > 0) {
      classification = { intent: "booking_servis", subflow: "A", confidence: 0.95 };
    }
  }

  if (classification.subflow !== "A") {
  if (code && ["CXCT01", "CXCT02", "CXCT03"].includes(code)) {
    classification = { intent: "broadcast_cxct", subflow: "I", confidence: 0.95 };
  } else {
    for (const rule of rules) {
      if (rule.intent === "booking_servis" && !hasBookingSignal(text || "")) {
        continue;
      }
      if (rule.patterns.some((p) => p.test(text || ""))) {
        classification = { intent: rule.intent, subflow: rule.subflow, confidence: 0.8 };
        break;
      }
    }
  }
  }

  if (!resolvedThreadId) {
    return { ...classification, logged: false, warning: "threadId missing; intent not logged" };
  }

  const logged = await logIntent(
    resolvedThreadId,
    classification.intent,
    classification.subflow,
    classification.confidence
  );
  return { ...logged, logged: true };
}

function resolveThreadId(threadId, metadata) {
  const direct = String(threadId || "").trim();
  if (direct) return direct;

  const waNumber = String(
    metadata?.waNumber || metadata?.from || metadata?.fromNumber || metadata?.chatId || ""
  )
    .replace(/@.+$/, "")
    .trim();
  if (!waNumber) return null;

  return `thr_${waNumber.replace(/[^\d]/g, "")}`;
}

async function logIntent(threadId, intent, subflow, confidence) {
  await pool.query(
    `INSERT INTO intent_logs (thread_id, intent, subflow, confidence, resolved_by)
     VALUES (?, ?, ?, ?, ?)`,
    [threadId, intent, subflow, confidence, "ai"]
  );
  return { intent, subflow, confidence };
}
