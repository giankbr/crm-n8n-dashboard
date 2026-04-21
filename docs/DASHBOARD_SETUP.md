# Dashboard Setup & Integration Guide

The dashboard is a **React 19 + Vite** frontend that connects to the backend API to display WhatsApp chatbot operations in real-time.

## Current Status ✅

- **Backend Routes**: Core endpoints implemented (some routes require auth token)
- **Vite Proxy**: Configured to proxy `/api` calls to `http://localhost:4000`
- **React Components**: Built with Shadcn UI, ready for data binding
- **API Hook**: `useDashboardData.js` handles all data fetching and auto-refresh

**All systems are ready to go!** Just start the services.

---

## Quick Start

### Option 1: Full Stack with Docker (Recommended for Development)

```bash
# Start all services (MySQL, Backend, n8n, WAHA, Bridge)
docker compose up -d --build

# Wait for services to be ready (10-15 seconds)
docker compose ps

# Start dashboard (separate terminal)
cd dashboard
npm install  # First time only
npm run dev

# Open dashboard at http://localhost:5173
```

### Option 2: Docker Backend + Local Dashboard Dev

```bash
# Start backend stack
docker compose up -d --build mysql backend

# Wait for backend to be ready
docker compose logs backend | grep "listening"

# Start dashboard in dev mode
cd dashboard
npm run dev

# Dashboard auto-proxies requests to http://localhost:4000
# Open http://localhost:5173
```

### Option 3: Full Local Setup

```bash
# Start MySQL (you need MySQL installed locally)
mysql -u root -p < init/01-schema.sql
mysql -u root -p < init/02-seed.sql

# Run migrations & seed
cd backend
npm install
npm run migrate
npm run seed
npm start

# Start dashboard (separate terminal)
cd dashboard
npm install
npm run dev

# Open http://localhost:5173
```

---

## Architecture

### Request Flow

```
User Browser
    ↓ (http://localhost:5173)
React Dashboard (Vite dev server)
    ↓ (Vite proxy: /api → http://localhost:4000)
Backend Express API
    ↓ (SQL queries)
MySQL Database
```

### Data Flow (Auto-Refresh)

```
1. Dashboard mounts → useDashboardData() hook runs
2. Hook fetches 4 endpoints in parallel:
   - GET /api/threads
   - GET /api/booking/today
   - GET /api/escalations
   - GET /api/waha/sessions
3. Data updates component state
4. Re-renders with new data
5. Every 10 seconds → repeat (auto-refresh)
```

---

## API Endpoints

> Important: dashboard endpoints are protected by bearer token in normal operation.  
> Login first, then send `Authorization: Bearer <token>` on protected requests.

### Inbox / Threads

**GET `/api/threads`** (Auto-refresh every 10s)
```json
{
  "threads": [
    {
      "thread_id": "thr_6281234567890",
      "wa_number": "6281234567890",
      "status": "active",
      "non_ai": false,
      "ai_paused_until": null,
      "last_message": "Mau booking servis",
      "last_message_at": "2026-04-07T10:30:45Z",
      "created_at": "2026-04-07T10:00:00Z",
      "updated_at": "2026-04-07T10:30:45Z"
    }
  ]
}
```

**GET `/api/threads/{threadId}/messages`** (Fetched when thread selected)
```json
{
  "messages": [
    {
      "id": 1,
      "thread_id": "thr_6281234567890",
      "direction": "incoming",
      "body": "Mau booking servis",
      "metadata": { "from": "6281234567890" },
      "sent_at": "2026-04-07T10:30:45Z"
    },
    {
      "id": 2,
      "thread_id": "thr_6281234567890",
      "direction": "outgoing",
      "body": "Halo, kapan Anda ingin booking?",
      "metadata": {},
      "sent_at": "2026-04-07T10:31:00Z"
    }
  ]
}
```

**POST `/api/chat/pause`** (Pause AI for 15 min)
```json
{
  "updated": true
}
```

**POST `/api/chat/non-ai`** (Toggle non-AI mode)
```json
{
  "updated": true,
  "nonAi": true
}
```

### Bookings

**GET `/api/booking/today`** (Auto-refresh every 10s)
```json
{
  "bookings": [
    {
      "id": 1,
      "thread_id": "thr_6281234567890",
      "vehicle": "Honda CB150",
      "plate": "AD 1234 AB",
      "service_type": "routine_check",
      "schedule_at": "2026-04-07T10:00:00Z",
      "status": "pending",
      "created_at": "2026-04-07T09:00:00Z"
    }
  ]
}
```

### Escalations

**GET `/api/escalations`** (Auto-refresh every 10s)
```json
{
  "escalations": [
    {
      "id": 1,
      "thread_id": "thr_6281234567890",
      "type": "complaint",
      "target_role": "admin",
      "reason": "Customer complained about service quality",
      "status": "open",
      "created_at": "2026-04-07T10:30:00Z"
    }
  ]
}
```

### WAHA Sessions

**GET `/api/waha/sessions`** (Auto-refresh every 10s)
```json
[
  {
    "name": "default",
    "status": "CONNECTED",
    "me": {
      "id": "6281234567890@c.us",
      "number": "6281234567890",
      "jid": "6281234567890@c.us"
    }
  }
]
```

**POST `/api/waha/sessions`** (Create/start session)
```json
{
  "name": "default",
  "ok": true
}
```

**POST `/api/waha/sessions/{name}/start`** (Start session)
```json
{
  "ok": true
}
```

**GET `/api/waha/sessions/{name}/qr`** (Get QR code for login)
```json
{
  "base64": "iVBORw0KGgoAAAANSUhEUgAAAAUA...",
  "mimeType": "image/png"
}
// OR
{
  "qrUnavailable": true,
  "message": "QR endpoint not available in this WAHA version",
  "dashboardUrl": "http://localhost:3000"
}
```

### Send Text Message

**POST `/api/waha/send-text`** (Reply to customer)
```json
{
  "method": "POST",
  "body": {
    "session": "default",
    "chatId": "6281234567890",
    "text": "Halo, pesanmu sudah kami terima"
  }
}
// Response
{
  "ok": true,
  "message": {
    "id": "msg_123",
    "status": "sent"
  }
}
```

---

## Dashboard Features

### 1. Control Center (Home)

Shows real-time statistics:
- Total threads (conversations)
- Today's bookings
- Open escalations
- WAHA sessions connected

### 2. Inbox

**Left Panel: Threads List**
- Shows all WhatsApp conversations
- Displays last message preview
- Click to select and view details

**Right Panel: Conversation Actions**
- View full message history (incoming/outgoing)
- **Pause AI**: Prevents AI from responding for 15 minutes
- **Set Non-AI**: Disables AI permanently (e.g., for escalated cases)
- **Remove Non-AI**: Re-enable AI responses

### 3. Bookings

Shows today's service bookings:
- Vehicle info (make/model, plate)
- Service type
- Scheduled time
- Booking status (pending/confirmed/completed)

### 4. Escalations

Monitor unresolved cases:
- Complaint type (complaint, pickup_validation, out_of_scope, etc.)
- Target role (admin/mechanic/branch_manager)
- Current status (open/in_progress/resolved)
- Related thread ID

### 5. WAHA Sessions

Manage WhatsApp account connections:
- Session name (usually "default")
- Connection status
- Create new sessions
- Start/stop sessions
- Scan QR code to connect

---

## Development

### Start Dashboard Dev Server

```bash
cd dashboard

# Install dependencies (first time only)
npm install

# Start Vite dev server on port 5173
npm run dev

# Hot reload enabled - changes saved = page reloads automatically
```

### Build for Production

```bash
cd dashboard

# Create optimized build in dist/
npm run build

# Preview production build locally
npm run preview

# Then deploy dist/ folder to your hosting
```

### Code Structure

```
dashboard/
├── src/
│   ├── components/
│   │   ├── admin-dashboard/
│   │   │   ├── page.jsx              # Main page layout
│   │   │   ├── use-dashboard-data.js # API data hook
│   │   │   └── components/
│   │   │       ├── crm-sections.jsx  # Inbox, Bookings, Escalations, WAHA UI
│   │   │       ├── sidebar.jsx
│   │   │       ├── header.jsx
│   │   │       └── ... other sections
│   │   └── ui/
│   │       ├── button.jsx
│   │       ├── card.jsx
│   │       ├── table.jsx
│   │       ├── sidebar.jsx
│   │       └── ... Shadcn UI primitives
│   ├── App.jsx                       # Router setup
│   ├── main.jsx                      # App entry point
│   └── index.css                     # Global styles
├── vite.config.js                    # Vite config (with /api proxy)
├── package.json
└── index.html
```

### Adding New Features

#### Example: Add "Resolve Escalation" Button

1. **Add endpoint in backend** (`backend/src/routes.js`):
```javascript
router.post("/escalations/:id/resolve", async (req, res, next) => {
  try {
    await pool.query("UPDATE escalations SET status = 'resolved' WHERE id = ?", [req.params.id]);
    res.json({ resolved: true });
  } catch (error) {
    next(error);
  }
});
```

2. **Update dashboard hook** (`dashboard/src/components/admin-dashboard/use-dashboard-data.js`):
```javascript
async function resolveEscalation(escalationId) {
  await api(`/escalations/${escalationId}/resolve`, { method: "POST" });
  loadAll(); // Refresh data
}

// Export function
return { ..., resolveEscalation };
```

3. **Add button in component** (`dashboard/src/components/admin-dashboard/components/crm-sections.jsx`):
```jsx
<Button onClick={() => resolveEscalation(e.id)}>
  Resolve
</Button>
```

---

## Troubleshooting

### Dashboard not loading

```bash
# 1. Check if backend is running
curl http://localhost:4000/api/health
# Should return: { "ok": true }

# 2. Check if dashboard dev server is running
curl http://localhost:5173
# Should return HTML

# 3. Check Vite proxy is configured
cat dashboard/vite.config.js
# Should have: "/api": { "target": "http://localhost:4000" }
```

### API calls failing (404, 500)

```bash
# 1. Check backend logs
docker compose logs backend

# 2. Test endpoint directly
curl -X GET http://localhost:4000/api/threads
# Should return: { "threads": [...] }

# 3. Check database is populated
docker compose exec mysql mysql -u chatbot_user -p chatbot_crm
> SELECT COUNT(*) FROM threads;
> SELECT COUNT(*) FROM messages;

# 4. Run seed if no data
docker compose exec backend npm run seed
```

### Threads not appearing

```bash
# Check if messages are being saved
docker compose exec mysql mysql -u chatbot_user -p chatbot_crm
> SELECT * FROM threads;
> SELECT * FROM messages;

# If empty, send test message via WAHA webhook
curl -X POST http://localhost:5678/webhook/waha/incoming \
  -H "Content-Type: application/json" \
  -d '{
    "waNumber": "6281234567890",
    "body": "Test message",
    "messageId": "test_'$(date +%s)'",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

### Auto-refresh not working

```javascript
// The hook refreshes every 10 seconds
// Check browser console for errors
// Open DevTools → Console (F12)

// Look for:
// - Network errors (red)
// - API response errors
// - JavaScript errors
```

### WAHA sessions not showing

```bash
# 1. Check WAHA is running
curl http://localhost:3000/health

# 2. Check WAHA credentials in .env
cat .env | grep WAHA_

# 3. Check backend can reach WAHA
docker compose logs backend | grep WAHA

# 4. Try getting sessions directly from backend
curl -X GET http://localhost:4000/api/waha/sessions
```

---

## Performance Tips

### Large Thread Lists (>1000 threads)

If dashboard feels slow with many threads:

1. **Limit query results** in backend:
```javascript
// backend/src/routes.js line 130+
// Add: LIMIT 100
SELECT ... FROM threads ... LIMIT 100
```

2. **Implement pagination** in components:
```jsx
const [page, setPage] = useState(1);
const threadsPerPage = 50;
const paginated = threads.slice((page-1)*threadsPerPage, page*threadsPerPage);
```

3. **Add search filter**:
```jsx
const [search, setSearch] = useState("");
const filtered = threads.filter(t => t.wa_number.includes(search));
```

### Reduce Auto-Refresh Frequency

If backend is overloaded:

```javascript
// dashboard/src/components/admin-dashboard/use-dashboard-data.js
// Change from 10000 to 30000 (30 seconds)
const timer = setInterval(loadAll, 30000);
```

### Enable Browser Caching

```javascript
// In useDashboardData.js
const api = async (path, options = {}) => {
  const cache = localStorage.getItem(path);
  if (cache && !options.skipCache) {
    return JSON.parse(cache);
  }
  
  const response = await fetch(`/api${path}`, options);
  // ...
  localStorage.setItem(path, JSON.stringify(data));
  return data;
};
```

---

## Monitoring & Analytics

### Track API Performance

Add timing to requests:

```javascript
async function api(path, options = {}) {
  const start = performance.now();
  const response = await fetch(`/api${path}`, options);
  const duration = performance.now() - start;
  
  console.log(`[API] ${path} took ${duration.toFixed(0)}ms`);
  
  if (duration > 2000) {
    console.warn(`⚠️ Slow API: ${path} (${duration.toFixed(0)}ms)`);
  }
  
  return response.json();
}
```

### Monitor Thread Activity

Add activity graph:

```jsx
const activity = threads.reduce((acc, t) => {
  const hour = new Date(t.updated_at).getHours();
  acc[hour] = (acc[hour] || 0) + 1;
  return acc;
}, {});

// Render in chart
<AreaChart data={Object.entries(activity).map(([h, count]) => ({
  hour: h,
  messages: count
}))} />
```

---

## Production Deployment

### Build Dashboard

```bash
cd dashboard
npm install
npm run build

# Output: dist/ folder with static files
```

### Serve with Backend (Recommended)

```javascript
// backend/src/server.js
import express from "express";
import path from "path";

const app = express();

// API routes
app.use("/api", router);

// Serve dashboard from dist/
app.use(express.static(path.join(__dirname, "../../dashboard/dist")));

// SPA fallback: all non-API routes go to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../../dashboard/dist/index.html"));
});

app.listen(4000);
```

### Or Serve Separately with Nginx

```nginx
server {
  listen 80;
  server_name localhost;

  # Dashboard
  location / {
    root /var/www/dashboard/dist;
    try_files $uri /index.html;
  }

  # API
  location /api {
    proxy_pass http://localhost:4000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
  }
}
```

---

## Future Features

- [ ] Real-time WebSocket updates (instead of polling)
- [ ] User authentication/login
- [ ] Role-based access (admin/manager/operator)
- [ ] Message templates for quick replies
- [ ] Bulk actions (pause multiple threads, etc.)
- [ ] Analytics dashboard (metrics, charts)
- [ ] Conversation search
- [ ] Export chat history
- [ ] Canned responses library
- [ ] Customer notes/tags

---

## Support

If dashboard issues persist:

1. Check browser console (F12 → Console tab)
2. Check backend logs: `docker compose logs backend`
3. Test API directly: `curl http://localhost:4000/api/threads`
4. Verify database: `docker compose exec mysql mysql -u chatbot_user -p chatbot_crm`
5. Restart services: `docker compose restart`
