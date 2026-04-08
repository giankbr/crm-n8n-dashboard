import { verifyDashboardToken } from "../modules/auth/auth.service.js";

export function requireAuth() {
  return (req, res, next) => {
    const header = String(req.headers.authorization || "");
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const user = verifyDashboardToken(token);
    if (!user) {
      return res.status(401).json({ error: "unauthorized", message: "Login required" });
    }
    req.user = user;
    next();
  };
}

export function requireRole(roles = []) {
  return (req, res, next) => {
    const allowed = new Set(roles);
    if (!req.user || !allowed.has(req.user.role)) {
      return res.status(403).json({ error: "forbidden", message: "Insufficient role" });
    }
    next();
  };
}
