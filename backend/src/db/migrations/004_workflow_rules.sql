CREATE TABLE IF NOT EXISTS workflow_rules (
  rule_key VARCHAR(64) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO workflow_rules (rule_key, enabled) VALUES
  ('autoReplyFallback', TRUE),
  ('autoReplyBooking', TRUE),
  ('autoEscalateComplaint', TRUE),
  ('pauseAiWhenHumanActive', TRUE),
  ('enforceBookingCutoff', TRUE),
  ('enableBridgePolling', TRUE)
ON DUPLICATE KEY UPDATE enabled = VALUES(enabled);
