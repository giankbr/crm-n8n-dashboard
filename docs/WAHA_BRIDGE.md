# WAHA Bridge Service

The WAHA Bridge is a polling service that connects the **WAHA WhatsApp API** to **n8n workflows** by continuously polling for incoming messages and forwarding them to n8n webhooks.

## Architecture

```
WAHA Service (port 3000)
         ↓ (polls every 3 seconds)
    WAHA Bridge
         ↓ (forwards incoming messages)
    n8n Webhook Receiver
         ↓ (routes to workflows)
    Workflow: core_router
         ↓
    Backend API
         ↓
    MySQL Database
```

## How It Works

1. **Polling**: Polls `WAHA_BASE_URL/api/{session}/chats` every `WAHA_POLL_MS` milliseconds
2. **Message Detection**: Identifies new incoming messages that haven't been seen before
3. **Normalization**: Extracts and normalizes message data into standard format
4. **Forwarding**: POSTs message to n8n webhook at `N8N_WEBHOOK_URL`
5. **Deduplication**: Marks messages as seen to prevent duplicate processing

## Deployment

### Option 1: Docker (Recommended)

The bridge runs automatically as a containerized service:

```bash
# Start full stack (includes waha-bridge)
docker compose up -d --build

# Verify service is running
docker compose ps | grep waha_bridge

# View logs
docker compose logs -f waha_bridge
```

### Option 2: Manual (Local Development)

```bash
# Install dependencies (none currently, but npm install for future)
cd scripts && npm install

# Run bridge
npm start

# Or with file watching (dev mode)
npm run dev
```

### Option 3: Systemd Service (Production VPS)

Create `/etc/systemd/system/waha-bridge.service`:

```ini
[Unit]
Description=WAHA Bridge Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=node
WorkingDirectory=/opt/waha-bridge
Environment="WAHA_BASE_URL=http://localhost:3000"
Environment="N8N_WEBHOOK_URL=http://localhost:5678/webhook/waha/incoming"
Environment="WAHA_SESSION=default"
Environment="WAHA_POLL_MS=3000"
ExecStart=/usr/bin/node /opt/waha-bridge/waha-bridge.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable waha-bridge
sudo systemctl start waha-bridge
sudo systemctl status waha-bridge
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WAHA_BASE_URL` | `http://localhost:3000` | WAHA API base URL |
| `WAHA_SESSION` | `default` | WAHA session name to poll |
| `WAHA_API_KEY` | (empty) | Optional API key for WAHA auth |
| `N8N_WEBHOOK_URL` | `http://localhost:5678/webhook/waha/incoming` | n8n webhook receiver |
| `WAHA_POLL_MS` | `3000` | Polling interval in milliseconds |

### Docker Compose (Auto-configured)

When using `docker compose up`, these are automatically set:

```yaml
environment:
  - WAHA_BASE_URL=http://waha:3000         # Docker internal network
  - WAHA_SESSION=default
  - N8N_WEBHOOK_URL=http://n8n:5678/webhook/waha/incoming
  - WAHA_POLL_MS=3000
  - WAHA_API_KEY=${WAHA_API_KEY:-}         # From .env if provided
```

## Message Format

### Incoming Message (from WAHA)

```javascript
{
  waNumber: "6281234567890",
  chatId: "6281234567890@c.us",
  body: "Mau booking servis",
  messageId: "3EB0ABD645A84E...",
  timestamp: "2026-04-07T10:30:45.000Z",
  metadata: { ... }
}
```

### After Normalization (to n8n)

```json
{
  "waNumber": "6281234567890",
  "chatId": "6281234567890",
  "body": "Mau booking servis",
  "messageId": "3EB0ABD645A84E...",
  "timestamp": "2026-04-07T10:30:45.000Z"
}
```

## Logging & Monitoring

### Log Levels

- `INFO`: Normal operations (startup, message forwarded, stats)
- `DEBUG`: Detailed operations (periodic stats dump)
- `WARN`: Recoverable errors (retry attempts)
- `ERROR`: Unrecoverable errors (fatal conditions)

### Log Format

```
[2026-04-07T10:30:45.123Z] [INFO] Forwarded message { from: '6281234567890', ... }
```

### View Logs

Docker:
```bash
docker compose logs -f waha_bridge
docker compose logs --tail=100 waha_bridge
```

Systemd:
```bash
journalctl -u waha-bridge -f
journalctl -u waha-bridge --since="10 minutes ago"
```

### Stats Tracked

- **messagesProcessed**: Total messages seen
- **messagesForwarded**: Successfully forwarded to n8n
- **errors**: Number of errors encountered
- **seenMessageCount**: Unique messages deduplicated
- **uptime**: Seconds since service started
- **lastError**: Last error message

Periodic stats dump every minute to logs.

## Error Handling

### Retry Logic

- **Transient failures**: Automatically retries up to 3 times with 1-second delays
- **Non-recoverable errors**: Logged and skipped, bridge continues polling
- **Connection failures**: Bridge waits and retries on next poll cycle

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `WAHA chats 401` | Invalid/missing API key | Check `WAHA_API_KEY` in .env |
| `WAHA chats 404` | Wrong WAHA_SESSION name | Verify session exists in WAHA dashboard |
| `n8n webhook 404` | Wrong webhook URL | Check n8n webhook URL is correct |
| `ECONNREFUSED` | Service not running | Check `docker compose ps`, start services |
| `ETIMEDOUT` | Network timeout | Check network connectivity, increase timeout |

## Troubleshooting

### Bridge not starting

```bash
# Check container logs
docker compose logs waha_bridge

# Check if port conflicts
docker compose ps

# Rebuild image
docker compose up -d --build waha_bridge
```

### Messages not forwarding

```bash
# Check WAHA is running and accessible
curl http://localhost:3000/health

# Check n8n webhook is listening
# Go to n8n UI and verify webhook URL

# Check bridge is polling correctly
docker compose logs -f waha_bridge | grep "Forwarded"

# Check for errors in logs
docker compose logs waha_bridge | grep ERROR
```

### High error rate

```bash
# Check network connectivity between containers
docker compose exec waha-bridge curl http://waha:3000/health

# Verify n8n is running
docker compose ps n8n

# Check system resources
docker stats waha_bridge

# Increase poll interval to reduce load
# Edit .env: WAHA_POLL_MS=5000
```

### Service crashes

```bash
# Check system logs
docker compose logs -f waha_bridge

# Check for OOM (out of memory)
docker stats waha_bridge

# Restart service
docker compose restart waha_bridge
```

## Performance Tuning

### Polling Interval

- **Fast** (1000ms): More responsive but higher CPU usage
- **Default** (3000ms): Good balance
- **Slow** (5000ms): Lower resource usage, higher latency

Set in `.env`:
```env
WAHA_POLL_MS=3000
```

### Resource Limits (Docker)

Add to docker-compose.yml:

```yaml
waha-bridge:
  resources:
    limits:
      cpus: '0.5'
      memory: 256M
    reservations:
      cpus: '0.25'
      memory: 128M
```

## Multi-Session Setup

To handle multiple WhatsApp numbers, run multiple bridge instances:

```yaml
waha-bridge-1:
  build: ./scripts
  environment:
    - WAHA_BASE_URL=http://waha:3000
    - WAHA_SESSION=branch_pusat
    - N8N_WEBHOOK_URL=http://n8n:5678/webhook/waha/incoming
  depends_on:
    - waha
    - n8n

waha-bridge-2:
  build: ./scripts
  environment:
    - WAHA_BASE_URL=http://waha:3000
    - WAHA_SESSION=branch_utara
    - N8N_WEBHOOK_URL=http://n8n:5678/webhook/waha/incoming
  depends_on:
    - waha
    - n8n

# ... repeat for branch_selatan, branch_timur
```

Or use environment variable:

```bash
docker compose -f docker-compose.yml -f docker-compose.multi-session.yml up -d
```

## Health Checks

### Docker Health Check

Built-in healthcheck runs every 30 seconds:

```bash
docker compose exec waha_bridge \
  wget --quiet --tries=1 --spider http://localhost:3000 || exit 1
```

### Manual Health Check

```bash
# Check if bridge is running
docker compose exec waha_bridge ps aux | grep waha-bridge

# Check recent activity
docker compose logs --tail=5 waha_bridge

# Check stats
docker compose logs waha_bridge | tail -20 | grep "stats"
```

## Monitoring & Alerting

### Export Metrics (Future Enhancement)

Consider adding Prometheus metrics:
- `waha_bridge_messages_processed_total`
- `waha_bridge_messages_forwarded_total`
- `waha_bridge_forwarding_errors_total`
- `waha_bridge_polling_duration_ms`

### Alert Conditions

- **Bridge down**: No log activity for >5 minutes
- **High error rate**: >10% of messages fail to forward
- **Memory leak**: Memory usage growing steadily
- **Webhook failures**: n8n webhook returning 5xx errors

## Development

### Running Tests

```bash
cd scripts
npm test
```

### Code Changes

For local testing without Docker:

```bash
cd scripts
npm run dev
```

Set environment variables:

```bash
export WAHA_BASE_URL=http://localhost:3000
export N8N_WEBHOOK_URL=http://localhost:5678/webhook/waha/incoming
npm run dev
```

## Future Enhancements

- [ ] Add database persistence for message queuing
- [ ] Add Prometheus metrics export
- [ ] Add webhook retry queue with exponential backoff
- [ ] Add message filtering rules
- [ ] Add circuit breaker pattern for n8n failures
- [ ] Add graceful shutdown with in-flight message handling
- [ ] Add WebSocket support instead of polling
- [ ] Add multi-session batching

## Related Services

- **WAHA**: WhatsApp HTTP API (port 3000)
- **n8n**: Workflow automation (port 5678)
- **Backend**: Express API (port 4000)
- **MySQL**: Database (port 3308)
