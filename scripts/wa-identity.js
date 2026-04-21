export function normalizeWaNumber(value = "") {
  return String(value || "")
    .replace(/@.+$/, "")
    .replace(/[^\d]/g, "")
    .trim();
}

export function extractIdentityFromIncoming({ chatId = "", from = "" } = {}) {
  const normalizedChatId = String(chatId || from || "").trim();
  const waFromChatId = normalizedChatId.includes("@") ? normalizedChatId.replace(/@.+$/, "") : "";
  const waFromFrom = String(from || "").replace(/@.+$/, "");
  const waNumber = normalizeWaNumber(waFromChatId || waFromFrom);
  return {
    chatId: normalizedChatId,
    waNumber
  };
}
