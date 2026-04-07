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
