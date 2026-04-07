# WhatsApp AI CRM Documentation

Complete documentation for the WhatsApp AI Chatbot CRM System.

## Quick Links

### 🚀 Getting Started
- **[QUICK_START.md](QUICK_START.md)** — 5-minute setup guide (start here!)
- **[DASHBOARD_SETUP.md](DASHBOARD_SETUP.md)** — Frontend setup & API reference

### 📚 Core Documentation

#### System Architecture
- **[workflow.md](workflow.md)** — Business requirements, subflows (A-I), system design
- **[IMPLEMENTATION.md](IMPLEMENTATION.md)** — Implementation overview

#### Component Guides
- **[DATABASE.md](DATABASE.md)** — Database schema, migrations, SQL queries, backup/restore
- **[WAHA_BRIDGE.md](WAHA_BRIDGE.md)** — WAHA polling bridge, deployment, monitoring
- **[N8N_WORKFLOWS.md](N8N_WORKFLOWS.md)** — Complete n8n workflow implementation guide (3 workflows, 8 subflows)

### 🔧 Configuration
- **[../.env.example](../.env.example)** — Environment variables with detailed descriptions

---

## Navigation by Role

### 👤 First-Time User
1. Read: [QUICK_START.md](QUICK_START.md) (5 min)
2. Start services: `docker compose up -d --build`
3. Configure WAHA: Connect WhatsApp number
4. Build workflows: Follow [N8N_WORKFLOWS.md](N8N_WORKFLOWS.md)
5. Test with messages

### 👨‍💻 Backend Developer
- **Database**: [DATABASE.md](DATABASE.md)
- **API Reference**: [N8N_WORKFLOWS.md](N8N_WORKFLOWS.md#api-endpoints)
- **WAHA Integration**: [WAHA_BRIDGE.md](WAHA_BRIDGE.md)
- **Architecture**: [workflow.md](workflow.md)

### 🎨 Frontend Developer
- **Dashboard**: [DASHBOARD_SETUP.md](DASHBOARD_SETUP.md)
- **API Reference**: [DASHBOARD_SETUP.md](DASHBOARD_SETUP.md#api-endpoints-all-implemented)
- **Component Structure**: [DASHBOARD_SETUP.md](DASHBOARD_SETUP.md#code-structure)

### 🔧 DevOps / Deployment
- **System Setup**: [QUICK_START.md](QUICK_START.md)
- **Database**: [DATABASE.md](DATABASE.md) (Backup, Restore, Troubleshooting)
- **WAHA Bridge**: [WAHA_BRIDGE.md](WAHA_BRIDGE.md) (Deployment options, Monitoring)
- **n8n Workflows**: [N8N_WORKFLOWS.md](N8N_WORKFLOWS.md) (Testing, Debugging)
- **Dashboard**: [DASHBOARD_SETUP.md](DASHBOARD_SETUP.md) (Production deployment)

### 🤖 n8n Workflow Builder
- **Complete Guide**: [N8N_WORKFLOWS.md](N8N_WORKFLOWS.md)
- **Step-by-step** for each workflow (core_router, scheduler, escalation)
- **Sample JSON files**: `../n8n/workflows/*.json`

---

## Document Overview

| Document | Size | Audience | Purpose |
|----------|------|----------|---------|
| QUICK_START.md | 6.3 KB | Everyone | 5-minute setup guide |
| DATABASE.md | 7.6 KB | Developers, DevOps | Schema, migrations, queries |
| WAHA_BRIDGE.md | 9.0 KB | Backend, DevOps | Message polling bridge setup |
| DASHBOARD_SETUP.md | 14.2 KB | Frontend, DevOps | React dashboard & API |
| N8N_WORKFLOWS.md | 18.3 KB | n8n builders | Complete workflow implementation |
| workflow.md | 9.8 KB | Architects, PMs | Business requirements & flows |
| IMPLEMENTATION.md | 2.4 KB | All | High-level implementation status |

---

## Key Concepts

### Workflow (business process)
How messages flow through the system:
1. **WhatsApp user** → sends message
2. **WAHA** → detects new chat
3. **WAHA Bridge** → polls WAHA, forwards to n8n
4. **n8n** → classifies intent, routes to subflow
5. **Backend** → validates, persists, creates records
6. **Reply** → sent back to WhatsApp

### Subflows (automation routes)
- **A**: Booking servis (appointment scheduling)
- **B**: Jemput antar (vehicle pickup/dropoff)
- **C**: FAQ & jam operasional (operating hours)
- **D**: History riwayat (service history lookup)
- **E**: Konsultasi (consultation & recommendations)
- **F**: Routing cabang (branch routing)
- **G**: Komplain (complaint handling)
- **H**: Out of scope (fallback)
- **I**: Ghosting/follow-up (future)

### Key Tables
- **threads** — Conversations (one per WhatsApp number)
- **messages** — Individual messages within thread
- **bookings** — Service appointments
- **pickup_requests** — Vehicle pickup requests
- **escalations** — Unresolved cases requiring human review
- **branches** — Service center locations

---

## Common Tasks

### Set up a new installation
→ [QUICK_START.md](QUICK_START.md)

### Add a new API endpoint
→ [DATABASE.md](DATABASE.md) + [N8N_WORKFLOWS.md](N8N_WORKFLOWS.md)

### Debug a message flow
→ Check logs: `docker compose logs [service]`  
→ Trace through: [workflow.md](workflow.md) → [N8N_WORKFLOWS.md](N8N_WORKFLOWS.md) → [WAHA_BRIDGE.md](WAHA_BRIDGE.md)

### Connect a new WhatsApp number
→ [WAHA_BRIDGE.md](WAHA_BRIDGE.md) (multi-session setup)  
→ [N8N_WORKFLOWS.md](N8N_WORKFLOWS.md#multi-session-setup)

### Deploy to production
→ [QUICK_START.md](QUICK_START.md#production-deployment)  
→ [DATABASE.md](DATABASE.md) (Backup/Restore)  
→ [DASHBOARD_SETUP.md](DASHBOARD_SETUP.md#production-deployment)

### Monitor the system
→ [WAHA_BRIDGE.md](WAHA_BRIDGE.md#monitoring--alerting)  
→ Dashboard: http://localhost:5173  
→ n8n: http://localhost:5678

---

## Troubleshooting

**Services won't start** → [QUICK_START.md](QUICK_START.md#troubleshooting)

**API calls failing** → [DASHBOARD_SETUP.md](DASHBOARD_SETUP.md#troubleshooting)

**Messages not appearing** → [WAHA_BRIDGE.md](WAHA_BRIDGE.md#troubleshooting)

**Database issues** → [DATABASE.md](DATABASE.md#troubleshooting)

**n8n workflows not working** → [N8N_WORKFLOWS.md](N8N_WORKFLOWS.md#debugging-tips)

---

## Getting Help

1. **Check logs**: `docker compose logs [service-name]`
2. **Read relevant doc**: Use navigation above based on your role
3. **Test manually**: Use `curl` commands in docs to test APIs
4. **Check database**: `docker compose exec mysql mysql -u chatbot_user -p chatbot_crm`

---

## File Structure

```
/docs              ← You are here
├── README.md       ← Documentation index
├── QUICK_START.md  ← 5-minute setup
├── DATABASE.md     ← Database schema & queries
├── WAHA_BRIDGE.md  ← Message polling bridge
├── DASHBOARD_SETUP.md ← Frontend & API
├── N8N_WORKFLOWS.md ← Workflow implementation
├── workflow.md     ← Business requirements
└── IMPLEMENTATION.md ← Status overview
```

---

## Contributing

When adding new features, update the relevant documentation:
- New endpoints? → Update [DATABASE.md](DATABASE.md) & [N8N_WORKFLOWS.md](N8N_WORKFLOWS.md)
- New workflow? → Update [N8N_WORKFLOWS.md](N8N_WORKFLOWS.md)
- New table? → Update [DATABASE.md](DATABASE.md)
- New deployment option? → Update [QUICK_START.md](QUICK_START.md)

---

**Last Updated**: April 7, 2026  
**Version**: 1.0.0

For issues, feature requests, or documentation improvements, please open an issue on GitHub.
