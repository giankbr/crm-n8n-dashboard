-- Migration 002: Create branches and bookings tables

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
