# Quick Start Guide (5 Minutes)

Get the WhatsApp AI CRM running in 5 minutes with Docker.

## Prerequisites

- **Docker & Docker Compose** installed ([Get Docker](https://www.docker.com/products/docker-desktop))
- **Git** (optional, for cloning the repo)
- **Port 5173, 4000, 5678, 3000, 3306** available (not in use)

## Step 1: Setup (1 min)

```bash
# Navigate to project directory
cd ai-agent-crm

# Copy environment template
cp .env.example .env

# (Optional) Edit .env if using non-default passwords
# nano .env
```

## Step 2: Start Services (2 min)

```bash
# Build and start all services in background
docker compose up -d --build

# Wait for services to be ready (10-15 seconds)
docker compose ps

# Verify all services show "Up" status
```

Expected output:
```
CONTAINER ID   IMAGE                    STATUS
xxx            devlikeapro/waha         Up 10s
xxx            docker.n8n.io/n8nio/n8n  Up 10s
xxx            mysql:8.0                Up 10s
xxx            crm_backend              Up 10s
xxx            waha_bridge              Up 10s
```

## Step 3: Initialize Database (1 min)

```bash
# Run database migrations and seed sample data
docker compose exec backend npm run migrate
docker compose exec backend npm run seed

# Output should show:
# ✓ Applied migration: 001_create_core_tables.sql
# ✓ Applied migration: 002_create_branches_and_bookings.sql
# ✓ Applied migration: 003_create_operational_tables.sql
# ✓ Seeded 4 branches
# ✓ Seeded 4 customers
```

## Step 4: Start Dashboard (1 min)

```bash
# In a NEW terminal window:
cd dashboard

npm install  # First time only
npm run dev

# Output:
# ➜  Local: http://localhost:5173/
# ➜  press h + enter to show help
```

## Step 5: Open Dashboard & Test

1. **Open dashboard**: [http://localhost:5173](http://localhost:5173)

2. **Verify data appears**:
   - Go to **Control Center** (Home)
   - Should show:
     - "Total Threads: 4"
     - "Today's Bookings: 1"
     - "Open Escalations: 2"
     - "WAHA Sessions: 1"

3. **Test incoming message** (in another terminal):
   ```bash
   curl -X POST http://localhost:5678/webhook/waha/incoming \
     -H "Content-Type: application/json" \
     -d '{
       "waNumber": "6289876543210",
       "body": "Test message from WhatsApp",
       "messageId": "msg_'$(date +%s)'",
       "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
     }'
   ```

4. **Verify message appeared**: Refresh dashboard Inbox → should see new thread

## Access Points

| Service | URL | Default Creds |
|---------|-----|---|
| **Dashboard** | http://localhost:5173 | None required |
| **n8n Workflows** | http://localhost:5678 | (First login: create account) |
| **WAHA Dashboard** | http://localhost:3000 | admin / admin123 |
| **Backend API** | http://localhost:4000/api | (Internal only) |
| **MySQL** | localhost:3308 | chatbot_user / chatbot_pass |

## What's Running

- **MySQL** (port 3308): Database with sample data (4 branches, 4 customers)
- **Backend** (port 4000): Express API server
- **n8n** (port 5678): Workflow automation (not auto-configured yet)
- **WAHA** (port 3000): WhatsApp API server
- **WAHA Bridge**: Polls WAHA for new messages, forwards to n8n
- **Dashboard** (port 5173): React admin UI

## Next Steps

### Setup WhatsApp Connection (5 min)

1. Go to [WAHA Dashboard](http://localhost:3000)
2. Login: `admin` / `admin123`
3. Click **"Start Default"**
4. Scan QR code with your WhatsApp phone

### Build n8n Workflows (10 min)

1. Go to [n8n Workflows](http://localhost:5678)
2. Follow guide: `N8N_WORKFLOWS.md` → Import workflows
3. Test with WhatsApp messages

### View Database

```bash
# Connect to MySQL
docker compose exec mysql mysql -u chatbot_user -p chatbot_crm

# Useful commands:
> SELECT COUNT(*) FROM threads;      # View conversations
> SELECT * FROM bookings;              # View bookings
> SELECT * FROM escalations;           # View escalations
```

### View Logs

```bash
# Backend logs
docker compose logs -f backend

# n8n logs
docker compose logs -f n8n

# WAHA logs
docker compose logs -f waha

# Bridge logs
docker compose logs -f waha_bridge
```

## Troubleshooting

### Services won't start
```bash
# Check port conflicts
lsof -i :5173  # Check port 5173, etc.

# Force remove old containers
docker compose down -v
docker compose up -d --build
```

### Database not initialized
```bash
# Re-run migrations and seed
docker compose exec backend npm run migrate
docker compose exec backend npm run seed
```

### Dashboard shows error
```bash
# Check if backend is running
curl http://localhost:4000/api/health
# Should return: { "ok": true }

# Check backend logs
docker compose logs backend
```

### Can't connect WAHA
```bash
# Test WAHA health
curl http://localhost:3000/health

# Check WAHA logs
docker compose logs waha

# Re-check credentials in .env
cat .env | grep WAHA
```

### Messages not appearing
```bash
# 1. Verify bridge is running
docker compose logs waha_bridge

# 2. Test webhook directly
curl -X POST http://localhost:5678/webhook/waha/incoming \
  -H "Content-Type: application/json" \
  -d '{"waNumber":"6281234567890","body":"test","messageId":"msg1","timestamp":"2026-04-07T10:00:00Z"}'

# 3. Check database for message
docker compose exec mysql mysql -u chatbot_user -p chatbot_crm \
  -e "SELECT * FROM messages ORDER BY created_at DESC LIMIT 1;"
```

## Stop Everything

```bash
# Stop services but keep data
docker compose stop

# Stop and remove containers (keep volumes)
docker compose down

# Stop and remove everything (delete data!)
docker compose down -v
```

## Production Deployment

For production:

1. Edit `.env` with real passwords & API keys
2. Set `NODE_ENV=production` in `.env`
3. Enable HTTPS (SSL_CERT_PATH, SSL_KEY_PATH)
4. Use external secrets manager
5. Set up CI/CD pipeline
6. See `DASHBOARD_SETUP.md` for Nginx setup

## Documentation

- **Full Setup**: See `DATABASE.md`, `WAHA_BRIDGE.md`, `DASHBOARD_SETUP.md`, `N8N_WORKFLOWS.md`
- **API Reference**: See `IMPLEMENTATION.md` and `N8N_WORKFLOWS.md`
- **Architecture**: See `workflow.md`

## Getting Help

- Check logs: `docker compose logs [service]`
- Test API: `curl http://localhost:4000/api/health`
- Verify Docker: `docker --version`, `docker compose --version`
- Read guides: See docs in root directory

---

**That's it!** You now have a full WhatsApp AI CRM running locally. 🎉

Next: Configure n8n workflows, connect your WhatsApp number, and test with messages.
