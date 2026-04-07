-- WhatsApp AI CRM Database Schema
-- This file is executed by Docker MySQL on first run

-- =====================================================================
-- CUSTOMERS & THREADS
-- =====================================================================

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wa_number VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wa_number (wa_number)
);

CREATE TABLE IF NOT EXISTS threads (
  thread_id VARCHAR(50) PRIMARY KEY,
  wa_number VARCHAR(20) NOT NULL,
  status ENUM('active', 'closed', 'archived') DEFAULT 'active',
  non_ai BOOLEAN DEFAULT FALSE,
  ai_paused_until DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wa_number (wa_number),
  INDEX idx_status (status),
  INDEX idx_ai_paused (ai_paused_until),
  FOREIGN KEY (wa_number) REFERENCES customers(wa_number) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  thread_id VARCHAR(50) NOT NULL,
  message_id VARCHAR(255),
  direction ENUM('incoming', 'outgoing') NOT NULL,
  body LONGTEXT,
  metadata JSON,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_thread_id (thread_id),
  INDEX idx_message_id (message_id),
  INDEX idx_sent_at (sent_at),
  FOREIGN KEY (thread_id) REFERENCES threads(thread_id) ON DELETE CASCADE
);

-- =====================================================================
-- BRANCHES (Multi-location)
-- =====================================================================

CREATE TABLE IF NOT EXISTS branches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone VARCHAR(20),
  operating_hours_weekday VARCHAR(50) DEFAULT '08:00-17:00',
  operating_hours_weekend VARCHAR(50) DEFAULT '08:00-16:00',
  closed_days VARCHAR(255),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_active (active),
  INDEX idx_coordinates (latitude, longitude)
);

-- =====================================================================
-- BOOKINGS
-- =====================================================================

CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT,
  thread_id VARCHAR(50) NOT NULL,
  vehicle VARCHAR(255),
  plate VARCHAR(20),
  service_type VARCHAR(100),
  schedule_at DATETIME NOT NULL,
  branch_id INT,
  pickup_flag BOOLEAN DEFAULT FALSE,
  status ENUM('pending', 'confirmed', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
  notes LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_thread_id (thread_id),
  INDEX idx_customer_id (customer_id),
  INDEX idx_schedule_at (schedule_at),
  INDEX idx_status (status),
  INDEX idx_plate (plate),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (thread_id) REFERENCES threads(thread_id) ON DELETE RESTRICT,
  FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL
);

-- =====================================================================
-- PICKUP REQUESTS (Jemput Antar)
-- =====================================================================

CREATE TABLE IF NOT EXISTS pickup_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT,
  thread_id VARCHAR(50) NOT NULL,
  distance_km DECIMAL(5, 2),
  est_cost INT DEFAULT 0,
  requires_human_validation BOOLEAN DEFAULT FALSE,
  status ENUM('pending', 'approved', 'in_progress', 'completed', 'rejected') DEFAULT 'pending',
  validated_by VARCHAR(255),
  notes LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_booking_id (booking_id),
  INDEX idx_thread_id (thread_id),
  INDEX idx_status (status),
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL,
  FOREIGN KEY (thread_id) REFERENCES threads(thread_id) ON DELETE RESTRICT
);

-- =====================================================================
-- SERVICE HISTORY (Lookup by License Plate)
-- =====================================================================

CREATE TABLE IF NOT EXISTS service_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  plate_no VARCHAR(20) NOT NULL,
  last_service_at DATETIME,
  service_type VARCHAR(100),
  replaced_parts LONGTEXT,
  cost INT,
  notes LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_plate_no (plate_no),
  INDEX idx_last_service_at (last_service_at)
);

-- =====================================================================
-- INTENT LOGS (Intent Classification History)
-- =====================================================================

CREATE TABLE IF NOT EXISTS intent_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  thread_id VARCHAR(50) NOT NULL,
  intent VARCHAR(100),
  subflow VARCHAR(10),
  confidence DECIMAL(3, 2),
  resolved_by ENUM('ai', 'human', 'system') DEFAULT 'ai',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_thread_id (thread_id),
  INDEX idx_intent (intent),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (thread_id) REFERENCES threads(thread_id) ON DELETE CASCADE
);

-- =====================================================================
-- ESCALATIONS (Unresolved Cases / Handover)
-- =====================================================================

CREATE TABLE IF NOT EXISTS escalations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  thread_id VARCHAR(50) NOT NULL,
  type VARCHAR(100),
  target_role ENUM('admin', 'mechanic', 'branch_manager') DEFAULT 'admin',
  reason LONGTEXT,
  status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
  assigned_to VARCHAR(255),
  notes LONGTEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  INDEX idx_thread_id (thread_id),
  INDEX idx_status (status),
  INDEX idx_target_role (target_role),
  FOREIGN KEY (thread_id) REFERENCES threads(thread_id) ON DELETE RESTRICT
);

-- =====================================================================
-- NON-AI WHITELIST (Numbers that should not receive AI responses)
-- =====================================================================

CREATE TABLE IF NOT EXISTS non_ai_list (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wa_number VARCHAR(20) NOT NULL UNIQUE,
  reason VARCHAR(255),
  added_by VARCHAR(255),
  expires_at DATETIME,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_wa_number (wa_number),
  INDEX idx_active (active)
);
