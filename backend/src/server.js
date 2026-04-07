import express from "express";
import { config } from "./config.js";
import router from "./routes.js";

const app = express();
app.use(express.json());
app.use("/api", router);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = Number(err?.status) || 500;
  const errorCode = status >= 500 ? "internal_server_error" : "bad_request";
  res.status(status).json({ error: errorCode, message: err.message });
});

app.listen(config.port, () => {
  console.log(`Backend listening on ${config.port}`);
});
