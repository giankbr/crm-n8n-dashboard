# Database Schema & Setup

This document describes the database schema, migrations, and seeding for the WhatsApp AI CRM system.

## Quick Start

### 1. Via Docker (Recommended for Development)

```bash
# Start the full stack (MySQL + migrations + seeds)
docker compose up -d --build

# Migrations & seeds run automatically on container startup
```

### 2. Via npm Scripts (After Docker is running)

```bash
# Run migrations
docker compose exec backend npm run migrate

# Seed sample data
docker compose exec backend npm run seed
```

### 3. Manual MySQL

```bash
# Connect to MySQL
mysql -h localhost -P 3308 -u chatbot_user -p chatbot_crm

# Then import migration files or use docker entrypoint
```

---

## Database Architecture

### Storage Locations

- **Docker Entrypoint**: `/init/*.sql` — Executed automatically on first container startup
- **Application Migrations**: `/backend/src/db/migrations/*.sql` — Tracked via `schema_migrations` table
- **Application Seeders**: `/backend/src/db/seed.js` — Node.js script for dynamic seed data

### Migration Strategy

Two-layer approach:

1. **Layer 1: Docker Entrypoint** (`/init`)
   - Files: `01-schema.sql`, `02-seed.sql`
   - Executed once on MySQL container creation
   - Suitable for rapid development setup
   - Does NOT track which migrations were applied

2. **Layer 2: Application Migrations** (`/backend/src/db/migrations`)
   - Files: `001_create_core_tables.sql`, `002_create_branches_and_bookings.sql`, etc.
   - Tracked in `schema_migrations` table
   - Can be run multiple times safely (idempotent)
   - Suitable for production deployments

---

## Database Schema Overview

### Core Tables

#### `customers`
- Stores WhatsApp customer metadata
- `wa_number` is unique identifier
- Linked to `threads` by `wa_number`

```
PK: id
Unique: wa_number
Fields: name, created_at, updated_at
```

#### `threads`
- Conversation thread per WhatsApp number
- Tracks AI pause state and non-AI mode
- `thread_id` format: `thr_[phone_digits_only]`

```
PK: thread_id (VARCHAR)
FK: wa_number → customers.wa_number
Fields: status, non_ai, ai_paused_until, created_at, updated_at
```

#### `messages`
- Individual messages within a thread
- Stores metadata (JSON) for extensibility
- Direction: `incoming` or `outgoing`

```
PK: id
FK: thread_id → threads.thread_id
Fields: message_id, direction, body, metadata, sent_at, created_at
```

---

### Operational Tables

#### `branches`
- Multi-location branch configuration
- Used for geolocation-based routing
- `latitude`, `longitude` for distance calculations

```
PK: id
Fields: name, latitude, longitude, phone, operating_hours_*, closed_days, active
Indexes: coordinates, active status
```

#### `bookings`
- Service appointment requests
- Linked to customer, thread, and branch
- `schedule_at` validates against branch hours

```
PK: id
FK: customer_id, thread_id, branch_id
Fields: vehicle, plate, service_type, schedule_at, pickup_flag, status, notes
Indexes: thread_id, schedule_at, plate, status
```

#### `pickup_requests`
- Vehicle jemput/antar (pickup/dropoff) SOP
- Distance-based validation: < 2km (auto), 2-7km (needs approval), > 7km (reject)
- Cost: 5,000 IDR per km

```
PK: id
FK: booking_id, thread_id
Fields: distance_km, est_cost, requires_human_validation, status, validated_by
```

#### `service_history`
- Vehicle service records lookup by `plate_no`
- Queried when customer provides license plate

```
PK: id
Fields: plate_no (indexed), last_service_at, service_type, replaced_parts, cost, notes
```

#### `intent_logs`
- AI intent classification history
- Used for analytics and debugging

```
PK: id
FK: thread_id
Fields: intent, subflow, confidence, resolved_by (ai/human/system)
Indexes: thread_id, intent, created_at
```

#### `escalations`
- Unresolved cases for human intervention
- Types: complaint, high_value_booking, technical_issue, out_of_scope

```
PK: id
FK: thread_id
Fields: type, target_role, reason, status, assigned_to, resolved_at
Indexes: thread_id, status, target_role
```

#### `non_ai_list`
- Whitelist of numbers that should NOT receive AI responses
- Can have expiry date for temporary blocks

```
PK: id
Unique: wa_number
Fields: reason, added_by, expires_at, active
```

---

### Migration Tracking

#### `schema_migrations`
- Tracks which migration files have been applied
- Prevents duplicate execution

```
PK: id (VARCHAR filename)
Fields: applied_at
```

---

## Relationships Diagram

```
customers (1) ──── (N) threads
                    ├─ (1) messages (N)
                    ├─ (1) bookings (N)
                    │       ├─ (1) branches
                    │       └─ (1) pickup_requests
                    ├─ (1) intent_logs (N)
                    └─ (1) escalations (N)

service_history (indexed by plate_no)
non_ai_list (by wa_number)
```

---

## Sample Data

### Default Branches
- Cabang Pusat - Adiwerna (-7.1234, 109.4567)
- Cabang Utara - Pesalakan (-6.9876, 109.5432)
- Cabang Selatan - Pacul (-7.3456, 109.3210)
- Cabang Timur - Cikditiro (-7.2345, 109.6789)

**Operating Hours**:
- Weekday: 08:00–17:00
- Weekend: 08:00–16:00
- Closed: Sunday

### Sample Customers
- `6281234567890` → Budi Santoso
- `6282345678901` → Siti Nurhaliza
- `6283456789012` → Ahmad Suryanto
- `6284567890123` → Rani Wijaya

---

## Views (Optional)

### `thread_summary`
Quick view of thread with customer info and last message:

```sql
SELECT * FROM thread_summary;
```

### `today_bookings`
Bookings scheduled for today (pending/confirmed):

```sql
SELECT * FROM today_bookings;
```

---

## Common Queries

### Get thread by phone number
```sql
SELECT * FROM threads WHERE wa_number = '6281234567890';
```

### Get all messages in a thread (chronological)
```sql
SELECT * FROM messages WHERE thread_id = 'thr_6281234567890' ORDER BY sent_at ASC;
```

### Find service history by plate
```sql
SELECT * FROM service_history WHERE plate_no = 'AD 1234 AB' ORDER BY last_service_at DESC LIMIT 1;
```

### List today's bookings by branch
```sql
SELECT b.*, br.name as branch_name, c.name as customer_name
FROM bookings b
JOIN branches br ON b.branch_id = br.id
LEFT JOIN customers c ON b.customer_id = c.id
WHERE DATE(b.schedule_at) = CURDATE()
AND b.status IN ('pending', 'confirmed')
ORDER BY b.schedule_at ASC;
```

### Check if number is in non-AI list
```sql
SELECT * FROM non_ai_list WHERE wa_number = '6281234567890' AND active = TRUE;
```

### Get all open escalations
```sql
SELECT e.*, t.wa_number, c.name as customer_name
FROM escalations e
JOIN threads t ON e.thread_id = t.thread_id
LEFT JOIN customers c ON t.wa_number = c.wa_number
WHERE e.status IN ('open', 'in_progress')
ORDER BY e.created_at DESC;
```

---

## Backup & Restore

### Backup MySQL Database
```bash
docker compose exec mysql mysqldump -u chatbot_user -p chatbot_crm > backup.sql
```

### Restore from Backup
```bash
docker compose exec -T mysql mysql -u chatbot_user -p chatbot_crm < backup.sql
```

---

## Troubleshooting

### "Foreign key constraint fails"
Ensure parent records exist before inserting child records.

Example: Create customer before creating thread.

### "Duplicate entry in schema_migrations"
Manually delete from `schema_migrations` table if migration file changed:
```sql
DELETE FROM schema_migrations WHERE id = '001_create_core_tables.sql';
```

### Connection Issues
```bash
# Check if MySQL container is running
docker compose ps

# Connect to MySQL directly
docker compose exec mysql mysql -u root -p
```

---

## Future Enhancements

- [ ] Add audit table for sensitive operations
- [ ] Add backup/archive table for old threads
- [ ] Add analytics table for KPIs
- [ ] Add webhook audit log
- [ ] Implement database encryption for sensitive fields

