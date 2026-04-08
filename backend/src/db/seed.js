import { pool } from "./pool.js";
import { ensureAdminUsersSeeded } from "../modules/auth/auth.service.js";

const branches = [
  { name: "Cabang Pusat - Adiwerna", latitude: -7.1234, longitude: 109.4567, phone: "0274-123456" },
  { name: "Cabang Utara - Pesalakan", latitude: -6.9876, longitude: 109.5432, phone: "0274-234567" },
  { name: "Cabang Selatan - Pacul", latitude: -7.3456, longitude: 109.3210, phone: "0274-345678" },
  { name: "Cabang Timur - Cikditiro", latitude: -7.2345, longitude: 109.6789, phone: "0274-456789" }
];

const customers = [
  { wa_number: "6281234567890", name: "Budi Santoso" },
  { wa_number: "6282345678901", name: "Siti Nurhaliza" },
  { wa_number: "6283456789012", name: "Ahmad Suryanto" },
  { wa_number: "6284567890123", name: "Rani Wijaya" }
];

async function seedBranches() {
  for (const b of branches) {
    await pool.query(
      `INSERT INTO branches (name, latitude, longitude, active)
       VALUES (?, ?, ?, TRUE)
       ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude)`,
      [b.name, b.latitude, b.longitude]
    );
  }
  console.log(`✓ Seeded ${branches.length} branches`);
}

async function seedCustomers() {
  for (const c of customers) {
    await pool.query(
      `INSERT INTO customers (wa_number, name)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [c.wa_number, c.name]
    );
  }
  console.log(`✓ Seeded ${customers.length} customers`);
}

async function seedSampleData() {
  // Create threads for each customer
  for (const c of customers) {
    const threadId = `thr_${c.wa_number.replace(/[^\d]/g, "")}`;
    await pool.query(
      `INSERT INTO threads (thread_id, wa_number, status)
       VALUES (?, ?, 'active')
       ON DUPLICATE KEY UPDATE status = 'active'`,
      [threadId, c.wa_number]
    );
  }
  console.log(`✓ Seeded ${customers.length} threads`);

  // Create sample messages
  const [threads] = await pool.query("SELECT thread_id FROM threads LIMIT 2");
  if (threads.length > 0) {
    await pool.query(
      `INSERT INTO messages (thread_id, message_id, direction, body, sent_at)
       VALUES (?, ?, 'incoming', 'Mau booking servis', NOW())`,
      [threads[0].thread_id, `msg_${Date.now()}`]
    );
    console.log("✓ Seeded sample messages");
  }

  // Create sample bookings
  const [customers_result] = await pool.query("SELECT id FROM customers LIMIT 1");
  const [branches_result] = await pool.query("SELECT id FROM branches LIMIT 1");
  if (customers_result.length > 0 && branches_result.length > 0 && threads.length > 0) {
    await pool.query(
      `INSERT INTO bookings (customer_id, thread_id, vehicle, plate, schedule_at, branch_id, status)
       VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY), ?, 'pending')`,
      [customers_result[0].id, threads[0].thread_id, "Honda CB150", "AD 1234 AB", branches_result[0].id]
    );
    console.log("✓ Seeded sample bookings");
  }

  // Create sample service history
  await pool.query(
    `INSERT INTO service_history (plate_no, last_service_at, replaced_parts, notes)
     VALUES (?, DATE_SUB(NOW(), INTERVAL 30 DAY), JSON_ARRAY('Oli'), 'Seeded sample history')
     ON DUPLICATE KEY UPDATE last_service_at = VALUES(last_service_at), replaced_parts = VALUES(replaced_parts), notes = VALUES(notes)`,
    ["AD 1234 AB"]
  );
  console.log("✓ Seeded sample service history");
}

async function main() {
  try {
    console.log("Starting seed...");
    await ensureAdminUsersSeeded();
    console.log("✓ Seeded admin users");
    await seedBranches();
    await seedCustomers();
    await seedSampleData();
    console.log("Seed complete! ✓");
  } catch (error) {
    console.error("Seed error:", error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
