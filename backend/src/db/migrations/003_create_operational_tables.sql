-- Migration 003: Create operational tables (pickup, service history, intent logs, escalations)

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
