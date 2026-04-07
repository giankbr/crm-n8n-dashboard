import { pool } from "./pool.js";

const branches = [
  { name: "Adiwerna/Pesalakan", latitude: -6.9371, longitude: 109.1332 },
  { name: "Pacul", latitude: -6.8792, longitude: 109.1259 },
  { name: "Cikditiro", latitude: -6.885, longitude: 109.1199 },
  { name: "Trayeman", latitude: -6.9025, longitude: 109.1511 }
];

async function main() {
  for (const b of branches) {
    await pool.query(
      `INSERT INTO branches (name, latitude, longitude, open_hours, holiday_rules, active)
       VALUES (?, ?, ?, JSON_OBJECT("weekday", "08:00-17:00", "weekend", "08:00-16:00"), JSON_ARRAY(), TRUE)
       ON DUPLICATE KEY UPDATE latitude = VALUES(latitude), longitude = VALUES(longitude)`,
      [b.name, b.latitude, b.longitude]
    );
  }

  console.log("Seed complete");
  await pool.end();
}

main().catch(async (error) => {
  console.error(error);
  await pool.end();
  process.exit(1);
});
