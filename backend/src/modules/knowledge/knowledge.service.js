import { pool } from "../../db/pool.js";
import fs from "fs/promises";
import path from "path";
import { config } from "../../config.js";

const faqTemplates = {
  jam_buka: [
    "Kita buka hari kerja jam 08:00-17:00, weekend jam 08:00-16:00 ya. Kalau mau, aku bantu lanjut booking sekarang.",
    "Jam operasional kami weekday 08:00-17:00 dan weekend 08:00-16:00. Mau sekalian aku bantu atur jadwal servisnya?",
    "Bengkel buka Senin-Jumat 08:00-17:00, Sabtu-Minggu 08:00-16:00. Kalau cocok, kita lanjut booking ya."
  ],
  default: [
    "Siap, ceritain dulu kebutuhan servisnya ya, nanti aku bantu arahin yang paling pas.",
    "Boleh, jelasin sedikit keluhan atau kebutuhan motornya dulu. Dari situ aku bantu pilih langkah berikutnya.",
    "Oke, kasih info singkat soal kebutuhan servisnya, biar aku bantu cek opsi yang paling cocok."
  ],
  oilRecommendation: [
    "Siap, buat rekomendasi oli biar tepat aku perlu tipe motor dan kilometer terakhir dulu ya.",
    "Boleh banget. Kirim tipe motor + kilometer saat ini ya, nanti aku bantu rekomendasi oli yang pas.",
    "Untuk oli, paling aman disesuaikan tipe motor dan kilometer terakhir. Share dua info itu ya."
  ],
  docsMissing: [
    "Makasih ya, pertanyaannya udah masuk. Biar nggak salah info, aku bantu teruskan ke tim admin dulu ya.",
    "Noted ya, biar jawabannya akurat aku teruskan dulu ke admin. Nanti tim kami lanjut bantu kamu.",
    "Aku catat pertanyaannya. Supaya infonya valid, aku lempar dulu ke admin ya."
  ],
  ollamaError: [
    "Siap, aku belum berani jawab ini sekarang biar nggak ngasih info keliru. Aku teruskan ke admin dulu ya.",
    "Maaf, aku belum bisa jawab otomatis untuk yang ini sekarang. Aku bantu teruskan ke admin ya.",
    "Biar aman dan akurat, untuk ini aku teruskan ke tim admin dulu ya."
  ]
};

function pickTemplate(options, seed = "") {
  const items = Array.isArray(options) ? options : [String(options || "")];
  if (items.length === 0) return "";
  const key = String(seed || "seed");
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 2147483647;
  }
  return items[Math.abs(hash) % items.length];
}

let cachedDocs = null;
let cachedAt = 0;

const querySynonyms = {
  booking: ["book", "jadwal", "reservasi", "reserve", "servis", "service"],
  pickup: ["jemput", "antar", "pick up"],
  jam: ["buka", "tutup", "operasional"],
  cabang: ["lokasi", "terdekat", "branch"],
  harga: ["biaya", "tarif", "cost"],
  admin: ["cs", "customer service", "operator"]
};

function tokenize(text = "") {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 2);
}

function expandQueryTokens(tokens) {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    for (const [key, synonyms] of Object.entries(querySynonyms)) {
      if (token === key || synonyms.includes(token)) {
        expanded.add(key);
        for (const synonym of synonyms) expanded.add(synonym);
      }
    }
  }
  return [...expanded];
}

function scoreByKeywordOverlap(query, content) {
  const tokens = expandQueryTokens(tokenize(query));
  if (tokens.length === 0) return 0;
  const text = String(content || "").toLowerCase();
  let matched = 0;
  for (const token of tokens) {
    if (text.includes(token)) matched += 1;
  }
  const overlap = matched / tokens.length;
  const headingBonus = /\b(q:|faq|pertanyaan|jawab|answer)\b/i.test(text) ? 0.08 : 0;
  return Math.min(1, overlap + headingBonus);
}

async function loadDocsCorpus() {
  const now = Date.now();
  if (cachedDocs && now - cachedAt < 60_000) return cachedDocs;
  const root = config.llm.docsDir;
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".md"));
  const docs = [];
  for (const file of files) {
    const fullPath = path.join(root, file.name);
    const content = await fs.readFile(fullPath, "utf8");
    docs.push({ source: file.name, content });
  }
  cachedDocs = docs;
  cachedAt = now;
  return docs;
}

async function retrieveDocsContext(query) {
  try {
    const docs = await loadDocsCorpus();
    const scored = docs
      .map((d) => ({ ...d, score: scoreByKeywordOverlap(query, d.content) }))
      .filter((d) => d.score >= 0.12)
      .sort((a, b) => b.score - a.score)
      .slice(0, config.llm.docsTopK);
    return scored.map((d) => ({
      source: d.source,
      score: Number(d.score.toFixed(3)),
      excerpt: d.content.slice(0, 2500)
    }));
  } catch {
    return [];
  }
}

async function askOllamaStrict({ question, contexts }) {
  const contextText = contexts
    .map(
      (c, idx) =>
        `[DOC ${idx + 1}] source=${c.source} score=${c.score}\n${c.excerpt}\n---`
    )
    .join("\n");
  const systemPrompt =
    "Kamu adalah asisten CRM bengkel dengan gaya bahasa natural dan hangat seperti CS manusia. Jawab HANYA berdasarkan konteks dokumen yang diberikan. Jika jawaban tidak ada di konteks, jawab singkat dan tawarkan eskalasi ke admin tanpa mengarang informasi.";
  const userPrompt = `Pertanyaan user: ${question}\n\nKonteks:\n${contextText}\n\nJawab dalam Bahasa Indonesia, ringkas dan operasional.`;

  const headers = { "Content-Type": "application/json" };
  if (config.llm.apiKey) headers.Authorization = `Bearer ${config.llm.apiKey}`;

  const response = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.llm.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`llm_failed_${response.status}:${text}`);
  }
  const json = await response.json();
  return String(json?.choices?.[0]?.message?.content || "").trim();
}

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
  const source = payload.source || "general";
  if (text.includes("jam") || text.includes("buka") || text.includes("tutup")) {
    return { reply: pickTemplate(faqTemplates.jam_buka, text), route: "faq_time" };
  }
  if (text.includes("oli")) {
    return {
      reply: pickTemplate(faqTemplates.oilRecommendation, text),
      route: "recommendation"
    };
  }

  // Outside explicit rule routes, use docs-grounded LLM fallback.
  if (source === "fallback" && config.llm.provider === "ollama") {
    const contexts = await retrieveDocsContext(text);
    if (contexts.length === 0) {
      return {
        reply: pickTemplate(faqTemplates.docsMissing, text),
        route: "fallback_docs_missing",
        grounded: false,
        sources: []
      };
    }
    try {
      const llmReply = await askOllamaStrict({ question: text, contexts });
      return {
        reply: llmReply || faqTemplates.default,
        route: "fallback_ollama_docs",
        grounded: true,
        sources: contexts.map((c) => ({ source: c.source, score: c.score }))
      };
    } catch {
      return {
        reply: pickTemplate(faqTemplates.ollamaError, text),
        route: "fallback_ollama_error",
        grounded: false,
        sources: contexts.map((c) => ({ source: c.source, score: c.score }))
      };
    }
  }

  return { reply: pickTemplate(faqTemplates.default, text), route: "general" };
}
