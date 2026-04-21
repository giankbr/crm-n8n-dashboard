# WhatsApp CRM Implementation Guide

## Services

- `waha` on `:3000`
- `n8n` on `:5678`
- `mysql` on `:3306`
- `backend` on `:4000`

## Run

1. Copy `.env.example` to `.env`.
2. Start stack:
   - `docker compose up -d --build`
3. Run DB setup in backend container:
   - `docker compose exec backend npm run migrate`
   - `docker compose exec backend npm run seed`

## n8n Workflows

Import files from:

- `n8n/workflows/core_router.json`
- `n8n/workflows/scheduler_reminders.json`
- `n8n/workflows/escalation_notifications.json`

## Backend API Contracts

- `POST /api/webhook/waha` persist incoming message
- `POST /api/chat/precheck` return `{ allowed, reason, nonAi, aiPausedUntil }`
- `POST /api/chat/pause` pause AI for thread
- `POST /api/chat/non-ai` toggle non-ai mode
- `POST /api/chat/classify` classify to intent/subflow
- `POST /api/booking/validate` cutoff validation
- `POST /api/booking/create` persist booking
- `GET /api/booking/today` scheduler booking fetch
- `POST /api/pickup/validate` SOP validation
- `POST /api/pickup/create` persist pickup request
- `POST /api/routing/resolve-branch` nearest branch routing
- `GET /api/history/:plateNo` service history lookup
- `POST /api/knowledge/reply` FAQ/consult reply
- `POST /api/handover/escalate` open escalation

## UAT Checklist (Current: 1 WA Session)

Default session:

- `default`

For the default session:

1. Send inbound message -> verify `messages` row created.
2. Toggle Non-AI -> verify AI stops responding.
3. Trigger pause (`/chat/pause`) -> verify AI blocked until timeout.
4. Booking valid window -> accepted.
5. Booking invalid window -> `cutoff_exceeded`.
6. Pickup at `1.5km` -> no human validation.
7. Pickup at `3.5km` -> human validation required.
8. Pickup at `8km` -> out of range.
9. Branch routing with coordinates -> target branch resolved.
10. Complaint phrase -> intent logged as `komplain` and escalation created.

Mark pass/fail and attach logs from backend + n8n execution.

> Note: Multi-session UAT can be added after multi-bridge/multi-session deployment is enabled.

## Dashboard (Vite)

The project includes `dashboard/` for a basic ops UI:

- Threads list + conversation detail
- Pause AI / Non-AI controls
- Today bookings
- Escalations list

Run locally:

1. Ensure backend is running on `http://localhost:4000`
2. Start dashboard:
   - `cd dashboard`
   - `npm install`
   - `npm run dev`
3. Open `http://localhost:5173`
