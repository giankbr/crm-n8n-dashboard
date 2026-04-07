-- Seed data for development & testing
-- This file is executed after schema creation

-- =====================================================================
-- SAMPLE BRANCHES
-- =====================================================================

INSERT INTO branches (name, latitude, longitude, phone, operating_hours_weekday, operating_hours_weekend, closed_days, active) VALUES
('Cabang Pusat - Adiwerna', -7.1234, 109.4567, '0274-123456', '08:00-17:00', '08:00-16:00', 'Sun', TRUE),
('Cabang Utara - Pesalakan', -6.9876, 109.5432, '0274-234567', '08:00-17:00', '08:00-16:00', 'Sun', TRUE),
('Cabang Selatan - Pacul', -7.3456, 109.3210, '0274-345678', '08:00-17:00', '08:00-16:00', 'Sun', TRUE),
('Cabang Timur - Cikditiro', -7.2345, 109.6789, '0274-456789', '08:00-17:00', '08:00-16:00', 'Sun', TRUE);

-- =====================================================================
-- SAMPLE CUSTOMERS
-- =====================================================================

INSERT INTO customers (wa_number, name) VALUES
('6281234567890', 'Budi Santoso'),
('6282345678901', 'Siti Nurhaliza'),
('6283456789012', 'Ahmad Suryanto'),
('6284567890123', 'Rani Wijaya');

-- =====================================================================
-- SAMPLE THREADS
-- =====================================================================

INSERT INTO threads (thread_id, wa_number, status, non_ai, ai_paused_until) VALUES
('thr_6281234567890', '6281234567890', 'active', FALSE, NULL),
('thr_6282345678901', '6282345678901', 'active', FALSE, NULL),
('thr_6283456789012', '6283456789012', 'active', FALSE, NULL),
('thr_6284567890123', '6284567890123', 'active', FALSE, NULL);

-- =====================================================================
-- SAMPLE MESSAGES
-- =====================================================================

INSERT INTO messages (thread_id, message_id, direction, body, metadata, sent_at) VALUES
('thr_6281234567890', 'msg_001', 'incoming', 'Mau booking servis untuk motor saya', JSON_OBJECT('from', '6281234567890', 'timestamp', NOW()), NOW()),
('thr_6281234567890', 'msg_002', 'outgoing', 'Halo Budi, saya siap membantu booking servis. Kapan Anda ingin membawa motor?', JSON_OBJECT('to', '6281234567890'), NOW()),
('thr_6282345678901', 'msg_003', 'incoming', 'Berapa jam buka?', JSON_OBJECT('from', '6282345678901', 'timestamp', NOW()), NOW()),
('thr_6282345678901', 'msg_004', 'outgoing', 'Kami buka weekday 08:00-17:00 dan weekend 08:00-16:00', JSON_OBJECT('to', '6282345678901'), NOW());

-- =====================================================================
-- SAMPLE BOOKINGS
-- =====================================================================

INSERT INTO bookings (customer_id, thread_id, vehicle, plate, service_type, schedule_at, branch_id, pickup_flag, status, notes) VALUES
(1, 'thr_6281234567890', 'Honda CB150', 'AD 1234 AB', 'routine_check', DATE_ADD(NOW(), INTERVAL 1 DAY), 1, TRUE, 'pending', 'Rutin check + ganti oli'),
(2, 'thr_6282345678901', 'Yamaha Mio', 'AD 5678 CD', 'repair', DATE_ADD(NOW(), INTERVAL 2 DAY), 2, FALSE, 'confirmed', 'Perbaikan sparepart');

-- =====================================================================
-- SAMPLE PICKUP REQUESTS
-- =====================================================================

INSERT INTO pickup_requests (booking_id, thread_id, distance_km, est_cost, requires_human_validation, status) VALUES
(1, 'thr_6281234567890', 1.5, 0, FALSE, 'approved'),
(2, 'thr_6282345678901', 3.2, 16000, TRUE, 'pending');

-- =====================================================================
-- SAMPLE SERVICE HISTORY
-- =====================================================================

INSERT INTO service_history (plate_no, last_service_at, service_type, replaced_parts, cost, notes) VALUES
('AD 1234 AB', DATE_SUB(NOW(), INTERVAL 30 DAY), 'routine_check', 'Oli', 150000, 'Ganti oli & filter'),
('AD 5678 CD', DATE_SUB(NOW(), INTERVAL 60 DAY), 'repair', 'Rantai, gir depan', 350000, 'Perbaikan rantai karena patah'),
('AD 9999 EF', DATE_SUB(NOW(), INTERVAL 15 DAY), 'routine_check', 'Busi', 50000, 'Ganti busi');

-- =====================================================================
-- SAMPLE INTENT LOGS
-- =====================================================================

INSERT INTO intent_logs (thread_id, intent, subflow, confidence, resolved_by) VALUES
('thr_6281234567890', 'booking_servis', 'A', 0.95, 'ai'),
('thr_6282345678901', 'faq_waktu', 'C', 0.88, 'ai'),
('thr_6283456789012', 'konsultasi', 'E', 0.85, 'ai'),
('thr_6284567890123', 'routing_cabang', 'F', 0.90, 'ai');

-- =====================================================================
-- SAMPLE ESCALATIONS
-- =====================================================================

INSERT INTO escalations (thread_id, type, target_role, reason, status, assigned_to) VALUES
('thr_6283456789012', 'complaint', 'admin', 'Pelanggan komplain tentang kualitas servis', 'open', 'admin_001'),
('thr_6284567890123', 'high_value_booking', 'branch_manager', 'Booking dengan jarak jauh memerlukan validasi', 'in_progress', 'manager_001');

-- =====================================================================
-- OPTIONAL: Create basic views for common queries
-- =====================================================================

CREATE VIEW IF NOT EXISTS thread_summary AS
SELECT
  t.thread_id,
  t.wa_number,
  c.name,
  t.status,
  t.non_ai,
  t.ai_paused_until,
  (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.thread_id) as message_count,
  (SELECT MAX(sent_at) FROM messages m WHERE m.thread_id = t.thread_id) as last_message_at,
  t.created_at,
  t.updated_at
FROM threads t
LEFT JOIN customers c ON t.wa_number = c.wa_number;

CREATE VIEW IF NOT EXISTS today_bookings AS
SELECT
  b.id,
  b.thread_id,
  c.name as customer_name,
  c.wa_number,
  b.vehicle,
  b.plate,
  b.service_type,
  b.schedule_at,
  br.name as branch_name,
  b.pickup_flag,
  b.status
FROM bookings b
LEFT JOIN customers c ON b.customer_id = c.id
LEFT JOIN branches br ON b.branch_id = br.id
WHERE DATE(b.schedule_at) = CURDATE()
AND b.status IN ('pending', 'confirmed');
