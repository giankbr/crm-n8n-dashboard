import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 4000),
  db: {
    host: process.env.MYSQL_HOST || "localhost",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "chatbot_user",
    password: process.env.MYSQL_PASSWORD || "your_secure_password",
    database: process.env.MYSQL_DATABASE || "chatbot_crm"
  },
  aiPauseMinutes: Number(process.env.AI_PAUSE_MINUTES || 15),
  ghosting: {
    hours: Number(process.env.GHOSTING_HOURS || 24),
    limit: Number(process.env.GHOSTING_LIMIT || 100)
  },
  googleSheets: {
    webhookUrl: process.env.GOOGLE_SHEETS_WEBHOOK_URL || ""
  },
  auth: {
    tokenSecret: process.env.DASHBOARD_AUTH_SECRET || "change_me_dashboard_secret",
    tokenTtlHours: Number(process.env.DASHBOARD_AUTH_TTL_HOURS || 12),
    users: process.env.DASHBOARD_USERS || "admin:admin123:admin"
  },
  waha: {
    baseUrl: process.env.WAHA_BASE_URL || "http://host.docker.internal:3000",
    dashboardUrl: process.env.WAHA_DASHBOARD_URL || "http://localhost:3000",
    username:
      process.env.WAHA_DASHBOARD_USERNAME ||
      process.env.WHATSAPP_SWAGGER_USERNAME ||
      "admin",
    password:
      process.env.WAHA_DASHBOARD_PASSWORD ||
      process.env.WHATSAPP_SWAGGER_PASSWORD ||
      "admin123",
    apiKey: process.env.WAHA_API_KEY || ""
  }
};
