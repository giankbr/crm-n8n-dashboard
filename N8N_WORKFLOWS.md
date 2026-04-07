# n8n Workflows Implementation Guide

This document provides step-by-step instructions to build and test the WhatsApp AI CRM workflows in n8n.

## Overview

Three main workflows orchestrate the chatbot:

1. **wa-core-router** — Main incoming message handler (webhook → classify → route → respond)
2. **scheduler-reminders** — Daily bookings reminder (cron → fetch bookings → send reminders)
3. **escalation-notifications** — Alert system for unresolved cases (webhook → notify admin)

## Prerequisites

- n8n running on `http://localhost:5678`
- Backend API running on `http://localhost:4000`
- WAHA running on `http://localhost:3000`
- MySQL database configured and running

---

## 1. Core Router Workflow (wa-core-router)

This is the heart of the system. It receives incoming WhatsApp messages and routes them to the appropriate subflow handler.

### High-Level Flow

```
WA Webhook (incoming message)
    ↓
Persist Message (save to DB)
    ↓
Precheck Thread (check if AI allowed)
    ├─ Non-AI mode? → Skip to fallback
    ├─ AI paused? → Skip to fallback
    └─ Allowed → Classify Intent
        ↓
    Classify Intent
        ↓
    Route by Subflow (A-I)
        ├─ Subflow A: Booking servis
        ├─ Subflow B: Pickup antar
        ├─ Subflow C: FAQ waktu operasional
        ├─ Subflow D: History riwayat
        ├─ Subflow E: Konsultasi
        ├─ Subflow F: Routing cabang
        ├─ Subflow G: Komplain/empati
        ├─ Subflow H: Out of scope
        └─ Fallback: Escalate & reply
```

### Implementation Steps

#### Step 1: Setup Webhook Receiver

1. Create new workflow: **wa-core-router**
2. Add node: **Webhook** (Trigger)
   - Path: `waha/incoming`
   - HTTP Method: POST
   - Connect to canvas

#### Step 2: Persist Incoming Message

1. Add node: **HTTP Request** (POST)
   - Name: "Persist Message"
   - URL: `http://backend:4000/api/webhook/waha`
   - Body:
   ```json
   {
     "waNumber": "=Webhook data?.body?.waNumber || .waNumber || .from",
     "body": "=Webhook data?.body?.body || .body || .text",
     "messageId": "=Webhook data?.messageId || .id",
     "timestamp": "=$now.toISO()"
   }
   ```
   - Connect from: Webhook → this node

3. Test: Send test message via WAHA dashboard, verify it appears in DB

#### Step 3: Precheck AI State

1. Add node: **HTTP Request** (POST)
   - Name: "Precheck Thread"
   - URL: `http://backend:4000/api/chat/precheck`
   - Body:
   ```json
   {
     "waNumber": "=Webhook initial input?.waNumber || .from"
   }
   ```
   - Connect: Persist Message → this node

2. Response will have: `{ allowed, reason, nonAi, aiPausedUntil }`

#### Step 4: Branch on AI Permission

1. Add node: **If**
   - Condition: `allowed === true`
   - True branch → Continue to Classify
   - False branch → Escalate & Reply (fallback)

#### Step 5: Classify Intent

1. Add node: **HTTP Request** (POST)
   - Name: "Classify Intent"
   - URL: `http://backend:4000/api/chat/classify`
   - Body:
   ```json
   {
     "threadId": "=Persist Message?.threadId",
     "text": "=Webhook initial input?.body",
     "metadata": {
       "waNumber": "=Webhook initial input?.waNumber"
     }
   }
   ```
   - Connect: If (true branch) → this node

2. Response will have: `{ intent, subflow, confidence }`

#### Step 6: Route by Subflow

1. Add node: **Switch**
   - Property to evaluate: `Classify Intent result?.subflow`
   - Rules (cases):
     - Case 1: `= "A"` → Subflow A handler
     - Case 2: `= "B"` → Subflow B handler
     - Case 3: `= "C"` → Subflow C handler
     - Case 4: `= "D"` → Subflow D handler
     - Case 5: `= "E"` → Subflow E handler
     - Case 6: `= "F"` → Subflow F handler
     - Case 7: `= "G"` → Subflow G handler
     - Case 8: `= "H"` → Fallback handler
     - Default: → Fallback handler

---

### Subflow A: Booking Servis (Service Booking)

#### Nodes to Add

```
Subflow A Input (from Switch)
    ↓
Validate Booking Window
    ├─ Valid? → Create Booking → Reply Success
    └─ Invalid? → Reply Invalid Window
```

#### Implementation

1. **Validate Booking Window** (HTTP Request POST)
   - URL: `http://backend:4000/api/booking/validate`
   - Body:
   ```json
   {
     "scheduleAt": "=Webhook data?.scheduleAt || Date.now() + 86400000",
     "branchCloseHour": "17:00",
     "weekendCloseHour": "16:00"
   }
   ```

2. **If Valid?** (If node)
   - Condition: `result?.valid === true`

3. **Create Booking** (HTTP Request POST) [True branch]
   - URL: `http://backend:4000/api/booking/create`
   - Body:
   ```json
   {
     "threadId": "=Persist Message?.threadId",
     "vehicle": "=Webhook data?.vehicle || 'Motor'",
     "plate": "=Webhook data?.plate || 'B1234ABC'",
     "serviceType": "=Webhook data?.serviceType || 'servis berkala'",
     "scheduleAt": "=Webhook data?.scheduleAt",
     "pickupFlag": false
   }
   ```

4. **Reply Booking Success** (HTTP Request POST)
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=Webhook data?.waNumber",
     "text": "Booking berhasil dibuat! Tim kami akan konfirmasi jadwal Anda."
   }
   ```

5. **Reply Invalid Window** (HTTP Request POST) [False branch]
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=Webhook data?.waNumber",
     "text": "Jadwal terlalu mepet jam tutup. Pilih jadwal lain ya 🙏"
   }
   ```

---

### Subflow B: Pickup Antar (Pickup/Dropoff)

#### Nodes to Add

```
Subflow B Input
    ↓
Validate Pickup (distance, SOP)
    ├─ Out of range → Reply out of range
    └─ In range →
        ├─ < 2km? → Auto-approve → Create → Reply
        └─ > 2km? → Escalate for approval → Reply pending
```

#### Implementation

1. **Validate Pickup** (HTTP Request POST)
   - URL: `http://backend:4000/api/pickup/validate`
   - Body:
   ```json
   {
     "distanceKm": "=Webhook data?.distanceKm || 1.5",
     "waNumber": "=Webhook data?.waNumber",
     "vehiclePlate": "=Webhook data?.plate"
   }
   ```

2. **Check Distance** (If node)
   - Condition: `result?.inRange === true`

3. **Check if needs approval** (If node)
   - Condition: `result?.requireHumanValidation === false`
   - True (< 2km): Auto-approve
   - False (2-7km): Needs approval

4. **Create Pickup Auto** (HTTP Request POST) [Auto-approve]
   - URL: `http://backend:4000/api/pickup/create`
   - Body:
   ```json
   {
     "threadId": "=Persist Message?.threadId",
     "distanceKm": "=result?.distanceKm",
     "estCost": 0,
     "requireHumanValidation": false,
     "status": "approved"
   }
   ```

5. **Reply Auto Approved** (HTTP Request POST)
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=Webhook data?.waNumber",
     "text": "Pickup berhasil dikonfirmasi! Petugas akan datang sesuai jadwal."
   }
   ```

6. **Escalate for Approval** (HTTP Request POST) [Needs approval]
   - URL: `http://backend:4000/api/handover/escalate`
   - Body:
   ```json
   {
     "threadId": "=Persist Message?.threadId",
     "type": "pickup_validation",
     "targetRole": "admin",
     "reason": "Pickup > 2km memerlukan validasi biaya"
   }
   ```

7. **Reply Pending Approval** (HTTP Request POST)
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=Webhook data?.waNumber",
     "text": "Pickup diminta akan kami validasi. Tim admin akan hubungi Anda segera 📞"
   }
   ```

---

### Subflow C: FAQ & Operating Hours

#### Nodes to Add

```
Subflow C Input
    ↓
Get FAQ Reply (based on keywords)
    ↓
Send Reply
```

#### Implementation

1. **Get FAQ Reply** (HTTP Request POST)
   - URL: `http://backend:4000/api/knowledge/reply`
   - Body:
   ```json
   {
     "intent": "faq_waktu",
     "contextType": "faq",
     "query": "=Webhook data?.body"
   }
   ```

2. **Send FAQ Reply** (HTTP Request POST)
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=Webhook data?.waNumber",
     "text": "=result?.reply"
   }
   ```

---

### Subflow D: Service History by License Plate

#### Nodes to Add

```
Subflow D Input
    ↓
Extract Plate Number
    ↓
Get Service History (from plate)
    ├─ Found? → Format & send
    └─ Not found? → Reply "no history"
```

#### Implementation

1. **Extract Plate** (Set node or expression)
   - Extract plate number from message using regex

2. **Get Service History** (HTTP Request GET)
   - URL: `http://backend:4000/api/history/{plateNo}`
   - Path: `=Webhook data?.plate || 'AD1234AB'`

3. **If Found?** (If node)
   - Condition: `result?.serviceRecords?.length > 0`

4. **Format History** (Set/Transform)
   - Create human-readable text from service records

5. **Send History** (HTTP Request POST)
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=Webhook data?.waNumber",
     "text": "=formatted history text"
   }
   ```

6. **Reply No History** (False branch)
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=Webhook data?.waNumber",
     "text": "Kami belum punya riwayat servis untuk plat nomor itu. Apakah baru pertama kali membawa ke kami?"
   }
   ```

---

### Subflow E: Konsultasi & Rekomendasi

#### Nodes to Add

```
Subflow E Input
    ↓
Get Recommendation (oil, parts, repair)
    ↓
Send Recommendation
```

#### Implementation

1. **Get Recommendation** (HTTP Request POST)
   - URL: `http://backend:4000/api/knowledge/reply`
   - Body:
   ```json
   {
     "intent": "konsultasi",
     "contextType": "consult",
     "query": "=Webhook data?.body"
   }
   ```

2. **Send Recommendation** (HTTP Request POST)
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=Webhook data?.waNumber",
     "text": "=result?.reply"
   }
   ```

---

### Subflow F: Routing to Nearest Branch

#### Nodes to Add

```
Subflow F Input
    ↓
Resolve Nearest Branch
    ├─ Success? → Forward WA + History → Reply
    └─ Fail? → Escalate → Reply
```

#### Implementation

1. **Resolve Branch** (HTTP Request POST)
   - URL: `http://backend:4000/api/routing/resolve-branch`
   - Body:
   ```json
   {
     "customerLat": "=Webhook data?.latitude || -7.1234",
     "customerLng": "=Webhook data?.longitude || 109.4567",
     "sourceBranch": "Pusat"
   }
   ```

2. **If Transfer OK?** (If node)
   - Condition: `result?.transferAllowed === true`

3. **Forward Info** (HTTP Request POST) [Success]
   - Send customer's phone and service history to target branch
   - Store in DB or send via webhook

4. **Reply Transfer** (HTTP Request POST)
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=Webhook data?.waNumber",
     "text": "Kami alihkan ke Cabang {branch}. Tim mereka akan menghubungi Anda segera."
   }
   ```

5. **Escalate Transfer Fail** (False branch)
   - URL: `http://backend:4000/api/handover/escalate`

---

### Subflow G: Komplain & Empati

#### Nodes to Add

```
Subflow G Input
    ↓
Log Complaint
    ↓
Send Empathetic Reply
    ↓
Escalate to Admin
```

#### Implementation

1. **Escalate Complaint** (HTTP Request POST)
   - URL: `http://backend:4000/api/handover/escalate`
   - Body:
   ```json
   {
     "threadId": "=Persist Message?.threadId",
     "type": "complaint",
     "targetRole": "admin",
     "reason": "=Webhook data?.body"
   }
   ```

2. **Send Empathetic Reply** (HTTP Request POST)
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=Webhook data?.waNumber",
     "text": "Kami mohon maaf atas pengalaman tidak memuaskan Anda 😔. Keluhan Anda sudah kami teruskan ke pimpinan kami untuk ditindaklanjuti."
   }
   ```

3. **Set Non-AI** (Optional - HTTP Request POST)
   - URL: `http://backend:4000/api/chat/non-ai`
   - Body: `{ "threadId": "=Persist Message?.threadId", "nonAi": true }`
   - Ensures human handles this case only

---

### Subflow H: Fallback / Out of Scope

This catches messages that don't match any intent or when AI is paused/disabled.

#### Nodes to Add

```
Subflow H Input (from If false, Switch default)
    ↓
Escalate to Admin
    ↓
Send Fallback Reply
```

#### Implementation

1. **Escalate** (HTTP Request POST)
   - URL: `http://backend:4000/api/handover/escalate`
   - Body:
   ```json
   {
     "threadId": "=Persist Message?.threadId",
     "type": "out_of_scope",
     "targetRole": "admin",
     "reason": "=Classify Intent?.reason || 'Message tidak cocok dengan intent apapun'"
   }
   ```

2. **Reply Fallback** (HTTP Request POST)
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=Webhook data?.waNumber",
     "text": "Pesan Anda sudah kami teruskan ke tim kami. Mohon tunggu sebentar 🙏"
   }
   ```

---

## 2. Scheduler Reminders Workflow

Sends daily reminders to customers with confirmed bookings.

### Implementation

1. **Trigger: Cron Job**
   - Name: "Daily Cron"
   - Time: 06:30 every day
   - Expression: `0 6 * * *` (optional advanced)

2. **Get Today Bookings** (HTTP Request GET)
   - URL: `http://backend:4000/api/booking/today`

3. **Loop Bookings** (Loop node)
   - Over: `result?.bookings`

4. **Check Pickup Flag** (If node)
   - If `pickupFlag === true` → Send pickup reminder
   - If `pickupFlag === false` → Send booking reminder

5. **Send Booking Reminder** (HTTP Request POST)
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=current item?.wa_number",
     "text": "Halo {name}, mengingatkan booking servis Anda hari ini pukul {time} di {branch}. Apakah masih jadi? ✅"
   }
   ```

6. **Send Pickup Reminder** (HTTP Request POST)
   - URL: `http://backend:4000/api/waha/send-text`
   - Body:
   ```json
   {
     "waNumber": "=current item?.wa_number",
     "text": "Halo {name}, petugas pickup akan datang sesuai jadwal hari ini. Siapkan motornya ya 🏍️"
   }
   ```

---

## 3. Escalation Notifications Workflow

Sends alerts to admin/manager when cases are escalated.

### Implementation

1. **Trigger: Webhook**
   - Path: `escalation/notify`
   - Method: POST

2. **Format Message** (Set/Transform node)
   - Create readable notification text

3. **Send to Admin WA** (HTTP Request POST)
   - URL: `http://localhost:3000/api/{session}/sendMessage`
   - Body:
   ```json
   {
     "to": "=escalation admin phone number",
     "message": "=formatted notification"
   }
   ```

4. **Log in Database** (Optional HTTP Request)
   - Store escalation sent status

---

## Testing the Workflows

### Test Subflow A (Booking)

```
Send to WAHA: "Saya ingin booking servis besok jam 10"
Expected: 
  - Message saved in DB
  - Intent classified as "booking_servis"
  - Routed to Subflow A
  - Booking window validated
  - Booking created
  - Reply sent back
```

### Test Subflow C (FAQ)

```
Send: "Jam buka berapa?"
Expected:
  - FAQ detected
  - Operating hours sent back
```

### Test Subflow G (Complaint)

```
Send: "Servis kalian sangat mengecewakan"
Expected:
  - Escalation created
  - Empathetic reply sent
  - Admin notified
```

### Test Precheck (AI Pause)

```
1. Set AI pause: POST /api/chat/pause { threadId: "..." }
2. Send message
Expected: Message accepted but no AI response, marked as "human_active"
```

---

## Debugging Tips

### Check Webhook Delivery

```bash
curl -X POST http://localhost:5678/webhook/waha/incoming \
  -H "Content-Type: application/json" \
  -d '{
    "waNumber": "6281234567890",
    "body": "Test message",
    "messageId": "test123",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
  }'
```

### View Execution Logs

1. Open n8n UI
2. Go to Workflow → Executions
3. Click on recent execution to see node outputs

### Test Backend Endpoints

```bash
# Test persist message
curl -X POST http://localhost:4000/api/webhook/waha \
  -H "Content-Type: application/json" \
  -d '{"waNumber":"6281234567890","body":"test"}'

# Test precheck
curl -X POST http://localhost:4000/api/chat/precheck \
  -H "Content-Type: application/json" \
  -d '{"waNumber":"6281234567890"}'

# Test classify
curl -X POST http://localhost:4000/api/chat/classify \
  -H "Content-Type: application/json" \
  -d '{"threadId":"thr_6281234567890","text":"booking servis"}'
```

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Webhook not triggering | Wrong path | Check path in Webhook node matches bridge URL |
| Backend returns 404 | Wrong URL | Verify `http://backend:4000` (Docker) vs `http://localhost:4000` |
| Messages not persisting | DB connection error | Check MySQL is running and backend can connect |
| Intent not classifying | Unknown intent | Check patterns in backend `intent.service.js` |
| WAHA send fails | Missing send-text endpoint | Implement `/api/waha/send-text` in backend |

---

## Future Enhancements

- [ ] Add OpenAI integration for intent confidence > 0.7 only
- [ ] Add message queue for retry on failure
- [ ] Add analytics/tracking per subflow
- [ ] Add A/B testing for different reply templates
- [ ] Add human handover with context transfer
- [ ] Add broadcast campaign support (Subflow I)
- [ ] Add voice message support
- [ ] Add media (image/file) handling

---

## WAHA Send Text Endpoint

The workflows need a backend endpoint to send messages back to WAHA. Add this to backend if not present:

```javascript
// backend/src/modules/waha/waha.service.js
import fetch from 'node-fetch';
import { config } from '../../config.js';

export async function sendText({ waNumber, text, session = 'default' }) {
  const url = `${config.waha.baseUrl}/api/${session}/sendText`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders()
    },
    body: JSON.stringify({
      chatId: `${waNumber}@c.us`,
      text
    })
  });

  if (!response.ok) {
    throw new Error(`WAHA send failed: ${response.status}`);
  }
  return response.json();
}

function getAuthHeaders() {
  if (config.waha.apiKey) {
    return { 'X-Api-Key': config.waha.apiKey };
  }
  if (config.waha.username && config.waha.password) {
    const auth = Buffer.from(`${config.waha.username}:${config.waha.password}`).toString('base64');
    return { 'Authorization': `Basic ${auth}` };
  }
  return {};
}
```

Then expose via route:

```javascript
// backend/src/routes.js
import { sendText } from './modules/waha/waha.service.js';

router.post('/waha/send-text', async (req, res, next) => {
  try {
    const result = await sendText(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

