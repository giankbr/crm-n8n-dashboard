export function normalizeWaNumber(value = "") {
  return String(value || "")
    .replace(/@.+$/, "")
    .replace(/[^\d]/g, "")
    .trim();
}

export function normalizeChatId(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  const digits = normalizeWaNumber(raw);
  return digits ? `${digits}@c.us` : "";
}
