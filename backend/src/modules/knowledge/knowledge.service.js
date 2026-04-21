import { pool } from "../../db/pool.js";
import fs from "fs/promises";
import path from "path";
import { config } from "../../config.js";

const faqTemplates = {
  jam_buka: "Kami buka weekday 08:00-17:00 dan weekend 08:00-16:00. Bisa saya bantu booking?",
  default: "Bisa dibantu jelaskan kebutuhan servisnya? Saya bantu cek jadwal terbaik."
};

let cachedDocs = null;
let cachedAt = 0;

function scoreByKeywordOverlap(query, content) {
  const tokens = String(query || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return 0;
  const text = String(content || "").toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (text.includes(token)) score += 1;
  }
  return score / tokens.length;
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
      .filter((d) => d.score > 0)
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
    "Kamu adalah asisten CRM bengkel. Jawab HANYA berdasarkan konteks dokumen yang diberikan. Jika jawaban tidak ada di konteks, jawab singkat bahwa informasi belum tersedia di knowledge base dan tawarkan eskalasi ke admin.";
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
    return { reply: faqTemplates.jam_buka, route: "faq_time" };
  }
  if (text.includes("oli")) {
    return {
      reply: "Untuk oli, kami rekomendasikan sesuai tipe motor dan kilometer terakhir. Boleh kirim tipe motor + kilometer saat ini?",
      route: "recommendation"
    };
  }

  // Outside explicit rule routes, use docs-grounded LLM fallback.
  if (source === "fallback" && config.llm.provider === "ollama") {
    const contexts = await retrieveDocsContext(text);
    if (contexts.length === 0) {
      return {
        reply: "Untuk pertanyaan ini, info di knowledge base kami belum cukup. Saya teruskan ke admin ya.",
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
        reply: "Saya belum bisa jawab otomatis saat ini. Pesan kamu saya teruskan ke admin ya.",
        route: "fallback_ollama_error",
        grounded: false,
        sources: contexts.map((c) => ({ source: c.source, score: c.score }))
      };
    }
  }

  return { reply: faqTemplates.default, route: "general" };
}
