# 🤖 WhatsApp AI Chatbot System

## 🎯 Objective

Membangun sistem chatbot AI WhatsApp yang mampu:

- Auto reply pelanggan  
- Booking servis otomatis  
- Jemput & antar kendaraan  
- Follow-up pelanggan otomatis  
- Integrasi dengan database  
- Routing ke cabang terdekat  
- Deteksi intent pelanggan  
- Guardrail takeover admin, nomor Non-AI, dan fallback ke manusia  

---

## 📌 Prioritas (MoSCoW)

| Prioritas | Isi |
| --------- | --- |
| **Must** | Booking, follow-up, aturan waktu operasional, FAQ, nama pelanggan, history servis via nopol, konsultasi, history chat, jeda AI saat admin aktif, komplain, fallback |
| **Should** | Jemput antar, routing cabang, validasi jenis motor, rekomendasi servis/oli, daftar nomor non-AI (tanpa respons AI) |
| **Could** | Ghosting / lead tertunda, broadcast berkode |

Urutan implementasi disarankan: Must → Should → Could.

---

## ⚙️ Fitur yang Dibutuhkan

### 1. WhatsApp Integration

- Menggunakan WAHA (WhatsApp HTTP API)  
- Default single session WhatsApp (`default`), multi-session sebagai pengembangan lanjutan  
- Webhook untuk menerima pesan  
- Kirim pesan (text, media, dll)  

---

### 2. Automation Workflow (n8n)

- Trigger dari webhook WhatsApp  
- Workflow drag & drop  
- Routing logic (if/else, switch)  
- Integrasi API & database  
- Scheduler (reminder booking, follow-up, ghosting 1×24 jam)  

---

### 3. AI Integration

- OpenAI-compatible API (opsional, jika node/credential n8n diaktifkan)  
- Gemini API (opsional, belum jadi alur utama)  

Status implementasi saat ini:

- Intent detection & subflow routing: **implemented (rule-based classifier)**  
- Natural language response: **partial (template/keyword reply, belum full LLM)**  
- Context understanding (thread + riwayat): **implemented untuk kebutuhan dasar**  

---

### 4. Database & penyimpanan

- **MySQL** sebagai sumber kebenaran utama (user, booking, chat, cabang, status, tabel Non-AI).  
- **Google Sheet** (opsional) hanya untuk mirror/operasional jika tim sudah pakai sheet—sinkron dari MySQL atau job terjadwal, agar tidak dobel sumber kebenaran.  

Data yang disimpan:

- User / pelanggan (termasuk mapping WA)  
- Booking servis  
- Riwayat chat (satu thread: AI + manusia)  
- Cabang / lokasi & jam operasional  
- Status order / lead  
- Nomor **Non-AI** (blacklist respons otomatis)  
- Konteks: `last_human_reply_at`, mode jeda AI, intent aktif  

---

## 🔄 Master Flow (ringkas)

1. Pesan WhatsApp masuk (termasuk balasan broadcast).  
2. Simpan ke history percakapan (ID, waktu, nomor, thread sama).  
3. **Nomor di tabel Non-AI?** → AI tidak menjawab; CS manual.  
4. **Admin/CS aktif membalas dalam 10–15 menit terakhir?** → Jeda AI sampai timeout; jika admin tetap aktif, biarkan manual.  
5. Bangun konteks: nama (dari DB/WA), cabang, waktu real-time, lokasi, kendaraan, riwayat jemput.  
6. **Balasan broadcast berkode CXCT01/02/03?** → Klasifikasi khusus sebelum intent umum.  
7. Klasifikasi intent utama → masuk **subflow** di bawah.  
8. Kapan pun perlu intervensi: notifikasi ke admin / mekanik / cabang tujuan.  
9. Selesai: booking tercatat, follow-up aktif, diteruskan ke admin, atau percakapan ditutup sopan.  

---

## 🧩 Subflow (A–I)

| Kode | Nama | Ringkasan |
| ---- | ---- | --------- |
| **A** | Booking + auto follow-up | Format data, validasi slot, reminder, respons setuju/sibuk/reschedule/no-reply |
| **B** | Jemput antar | SOP jarak, biaya, validasi CS, notifikasi petugas |
| **C** | FAQ + waktu operasional | Jam buka/tutup, cabang libur, jawaban template |
| **D** | History servis via nopol | Lookup riwayat, part, tawaran lanjutan |
| **E** | Konsultasi / rekomendasi | Gejala, harga, oli—knowledge base + eskalasi jika perlu |
| **F** | Pengalihan antar cabang | Cabang terdekat/buka, forward nomor + history, persetujuan pelanggan |
| **G** | Komplain / empati | Template empatik, Non-AI jika perlu, notifikasi admin/mekanik |
| **H** | Out of scope / media / unknown | Media, PKL/loker/IG, estimasi di luar knowledge → tunggu + admin |
| **I** | Ghosting / follow-up 1×24 jam | Lead tertunda, satu kali follow-up sesuai tingkat minat |

Detail decision tree per subflow mengikuti dokumen flowchart (bisa dipecah per halaman di Draw.io).

---

## 📋 Aturan Bisnis (inti)

### Booking servis

- **H−1**: isi format booking lalu persist ke DB (sheet hanya mirror jika dipakai).  
- **Hari H**: weekday maksimal **1 jam** sebelum tutup; weekend maksimal **2 jam** sebelum tutup.  
- Slot hari H tidak valid → tawarkan jadwal lain; jika setuju hari lain, kembali ke pengisian format.  
- **Scheduler pagi (contoh 06.00–07.30)**: ambil booking untuk hari ini; reminder sesuai jemput antar Ya/Tidak.  
- Respons pelanggan (setuju / sibuk / reschedule / tidak membalas) mengarahkan ke pickup, booking ulang, atau notifikasi admin.  

### Jemput antar & routing cabang

- **SOP**: minimal servis rutin injeksi; maksimum **7 km** dari bengkel.  
- Jarak **> 2 km**: AI hitung estimasi biaya → **validasi CS manusia**.  
- Di luar jangkauan → tawarkan booking atau datang langsung.  
- **Cabang aktif (referensi)**: Adiwerna/Pesalakan, Pacul, Cikditiro, Trayeman—selalu cek jam buka, hari tutup, lokasi, cabang terdekat.  
- **Routing**: cocokkan cabang asal & jam; jika perlu dialihkan → forward nomor + history; cabang tujuan follow-up manual; jika menolak/no reply → notifikasi admin cabang asal.  

### FAQ, nama, motor

- Nama dari DB/WA: jika tidak ada → sapaan "Sobat Fit" / username.  
- Cek waktu real-time vs jam operasional cabang.  
- Motor: jika banyak unit di DB → minta pilih; edukasi batas layanan (motor lama, dll.) sesuai kebijakan bengkel.  

### Broadcast (Could)

- Kode pemicu **CXCT01 / CXCT02 / CXCT03**: identifikasi kode + pola balasan.  
- Pertanyaan teknis/negatif/di luar konteks → admin.  
- Jika **3 balasan AI** tanpa kepastian → tutup sopan dan akhiri.  

### Komplain & fallback

- Komplain: respons empatik + template; tambah **Non-AI** jika perlu penanganan manual.  
- Media / di luar knowledge: minta tunggu, arahkan admin.  

---

## 🛡️ Kontrol AI vs Admin

- Semua chat AI & manusia dalam **satu thread** tersimpan.  
- CS mengirim pesan langsung (bukan broadcast) → **pause AI 10–15 menit**.  
- Setelah timeout, jika admin tidak membalas lagi → AI boleh ambil alih.  
- Tabel **Non-AI**: isi otomatis atau manual; **dikeluarkan** saat kasus selesai (servis selesai, konsultasi/komplain tuntas).  

---

## 🗃️ Model data & status percakapan (minimum)

Field/logik yang berguna untuk n8n + DB:

- `thread_id`, `wa_number`, `message_id`, `timestamp`, `direction`, `body`, `metadata` (broadcast code, lokasi, media).  
- `intent`, `subflow`, `confidence` (opsional).  
- `ai_paused_until` atau `last_human_reply_at` untuk jeda AI.  
- `non_ai` (boolean / expiry).  
- `lead_status` (untuk ghosting / follow-up).  

---

## 🔔 Eskalasi & notifikasi

Kirim notifikasi ke admin / mekanik / cabang tujuan ketika:

- Booking butuh konfirmasi operasional atau slot bermasalah.  
- Jemput antar perlu eksekusi atau validasi biaya.  
- Routing antar cabang atau penolakan pelanggan.  
- Komplain, Non-AI, atau pesan di luar kemampuan AI.  

---

## 🔄 Flow Sistem (level ringkas)

### 1. Booking servis

User chat → AI deteksi intent booking → kumpulkan data kendaraan & jadwal → validasi aturan waktu → simpan ke DB → konfirmasi & reminder (n8n).  

### 2. Jemput antar

User minta pickup → lokasi → cek SOP jarak & biaya → cabang terdekat → assign/notify petugas → update DB.  

### 3. Auto follow-up

Setelah servis atau titik tertentu → delay (n8n) → pesan follow-up → feedback / upsell / handoff.  

### 4. Routing cabang

Lokasi + jam operasional → cabang tujuan → forward WA + history jika disetujui.  

### 5. Intent detection (perluasan)

Contoh intent / cluster:

- `booking_servis`, `jemput_kendaraan`, `faq_waktu`, `history_nopol`, `konsultasi`, `rekomendasi`, `routing_cabang`, `komplain`, `broadcast_cxct`, `ghosting`, `fallback_admin`.  

---

## 🧠 Arsitektur Sistem

```text
[ WhatsApp User ]
        ↓
     WAHA API
        ↓ (Webhook)
       n8n
   ┌───────────────┐
   │ Workflow AI   │
   │ - Intent      │
   │ - Subflow     │
   │ - Guardrail   │
   └───────────────┘
        ↓
  ┌───────────────┐
  │ AI (optional) │
  └───────────────┘
        ↓
  ┌───────────────┐
  │ MySQL DB      │
  │ (+ ops. Sheet)│
  └───────────────┘
        ↓
     Response
        ↓
   WhatsApp User
```

---

## 🧩 Teknologi

- n8n → automation workflow  
- WAHA / WhatsApp API → komunikasi WhatsApp  
- Rule-based classifier + optional OpenAI-compatible provider  
- MySQL → database utama  
- Google Sheet → opsional (laporan/mirror, bukan sumber kebenaran ganda tanpa aturan)  
- VPS (Ubuntu) → hosting  

---

## 🖥️ Deployment

### Server Requirement

- VPS Ubuntu 20.04+  
- Docker (recommended)  
- Node.js (opsional)  
- MySQL  

---

### Service yang Dijalankan

- WAHA service (WhatsApp session)  
- n8n service  
- MySQL database  
- AI API (external)  

---

### Multi WhatsApp Setup (roadmap)

- Runtime default saat ini: 1 session WAHA (`default`)  
- Multi-session per nomor WA tetap didukung sebagai pola deployment lanjutan  

---

## 📦 Output yang Diharapkan

- Sistem berjalan di VPS  
- WhatsApp auto-reply real-time dengan guardrail admin & Non-AI  
- Flow automation sesuai prioritas Must → Should → Could  
- Multi nomor aktif  
- Dokumentasi penggunaan & aturan bisnis tersedia  

---

## 📘 Dokumentasi User (Basic)

### Cara Pakai

1. User chat ke WhatsApp  
2. Sistem otomatis respon (kecuali nomor Non-AI atau mode jeda AI)  
3. Booking / request diproses sesuai aturan waktu & SOP  
4. Admin monitor via database / dashboard; notifikasi untuk kasus eskalasi  

---

## 🚀 Next Step

- Dashboard admin (Next.js / Laravel): Non-AI, pause AI, lihat thread  
- Queue & scheduler tegas (reminder, ghosting, sync sheet jika dipakai)  
- Knowledge base terstruktur (FAQ, gejala, oli) + vector search opsional  
- Analytics (chat, conversion booking, SLA admin)  
- Role-based routing (CS / admin / cabang)  

---
