import { config } from "../../config.js";

export async function syncBookingToGoogleSheets(booking) {
  if (!config.googleSheets.webhookUrl) {
    return { synced: false, skipped: true, reason: "webhook_not_configured" };
  }

  const response = await fetch(config.googleSheets.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "ai-agent-crm",
      type: "booking_created",
      booking
    })
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Google Sheets sync failed: ${response.status} ${body}`);
    err.status = 502;
    throw err;
  }

  return { synced: true };
}
