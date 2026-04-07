import { pool } from "../../db/pool.js";

const faqTemplates = {
  jam_buka: "Kami buka weekday 08:00-17:00 dan weekend 08:00-16:00. Bisa saya bantu booking?",
  default: "Bisa dibantu jelaskan kebutuhan servisnya? Saya bantu cek jadwal terbaik."
};

export async function getServiceHistoryByPlate(plateNo) {
  const [rows] = await pool.query(
    `SELECT plate_no, last_service_at, replaced_parts, notes
     FROM service_history
     WHERE plate_no = ?
     ORDER BY last_service_at DESC
     LIMIT 1`,
    [plateNo]
  );
  return rows[0] || null;
}

export async function buildKnowledgeReply(payload) {
  const text = (payload.text || "").toLowerCase();
  if (text.includes("jam") || text.includes("buka") || text.includes("tutup")) {
    return { reply: faqTemplates.jam_buka, route: "faq_time" };
  }
  if (text.includes("oli")) {
    return {
      reply: "Untuk oli, kami rekomendasikan sesuai tipe motor dan kilometer terakhir. Boleh kirim tipe motor + kilometer saat ini?",
      route: "recommendation"
    };
  }
  return { reply: faqTemplates.default, route: "general" };
}
