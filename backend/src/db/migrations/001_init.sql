CREATE TABLE IF NOT EXISTS schema_migrations (
  id VARCHAR(64) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  wa_number VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(128),
  profile JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS threads (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  thread_id VARCHAR(64) NOT NULL UNIQUE,
  wa_number VARCHAR(32) NOT NULL,
  status VARCHAR(32) DEFAULT 'active',
  ai_paused_until DATETIME NULL,
  non_ai BOOLEAN DEFAULT FALSE,
  lead_status VARCHAR(32) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_threads_wa_number (wa_number),
  INDEX idx_threads_non_ai (non_ai)
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  thread_id VARCHAR(64) NOT NULL,
  message_id VARCHAR(128),
  direction VARCHAR(16) NOT NULL,
  body TEXT,
  metadata JSON,
  sent_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_messages_thread_id (thread_id),
  INDEX idx_messages_sent_at (sent_at)
);

CREATE TABLE IF NOT EXISTS branches (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL UNIQUE,
  latitude DECIMAL(10,7) NULL,
  longitude DECIMAL(10,7) NULL,
  open_hours JSON,
  holiday_rules JSON,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NULL,
  thread_id VARCHAR(64) NOT NULL,
  vehicle VARCHAR(128) NOT NULL,
  plate VARCHAR(32) NOT NULL,
  service_type VARCHAR(255),
  schedule_at DATETIME NOT NULL,
  branch_id BIGINT NULL,
  pickup_flag BOOLEAN DEFAULT FALSE,
  status VARCHAR(32) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bookings_thread_id (thread_id),
  INDEX idx_bookings_schedule_at (schedule_at)
);

CREATE TABLE IF NOT EXISTS pickup_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  booking_id BIGINT NULL,
  thread_id VARCHAR(64) NOT NULL,
  distance_km DECIMAL(6,2),
  est_cost DECIMAL(10,2),
  requires_human_validation BOOLEAN DEFAULT FALSE,
  status VARCHAR(32) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  plate_no VARCHAR(32) NOT NULL,
  last_service_at DATETIME,
  replaced_parts JSON,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_service_history_plate (plate_no)
);

CREATE TABLE IF NOT EXISTS escalations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  thread_id VARCHAR(64) NOT NULL,
  type VARCHAR(64) NOT NULL,
  target_role VARCHAR(64) NOT NULL,
  reason TEXT,
  status VARCHAR(32) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_escalations_thread_id (thread_id)
);

CREATE TABLE IF NOT EXISTS intent_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  thread_id VARCHAR(64) NOT NULL,
  intent VARCHAR(64) NOT NULL,
  subflow VARCHAR(64),
  confidence DECIMAL(5,2),
  resolved_by VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_intent_logs_thread_id (thread_id)
);
