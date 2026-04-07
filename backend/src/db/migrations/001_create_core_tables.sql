-- Migration 001: Create core tables (customers, threads, messages)

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
