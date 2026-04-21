# Knowledge Base FAQ (Operasional)

Dokumen ini dipakai sebagai sumber utama fallback AI (docs-grounded) untuk menjawab pertanyaan umum customer.

## Booking Servis

Q: Bagaimana cara booking servis?
A: Customer kirim intent booking, lalu sistem akan minta data bertahap: nama, nopol, jenis motor, tanggal/jam, dan pickup. Booking dibuat setelah semua data lengkap.

Q: Apakah bisa booking untuk besok jam 10?
A: Bisa, selama masih memenuhi aturan cutoff operasional bengkel.

Q: Kenapa belum langsung dapat ID booking?
A: ID booking baru dibuat setelah seluruh form booking lengkap.

## Pickup / Jemput Kendaraan

Q: Apakah ada layanan pickup motor?
A: Ada. Sistem validasi jarak pickup.

Q: Batas jarak pickup berapa?
A: Di atas 7 km dianggap out of range. Di rentang 2-7 km perlu validasi admin. Kurang atau sama dengan 2 km bisa auto-approve.

Q: Kalau jarak 1.5 km bagaimana?
A: Masuk auto-approve pickup.

## Jam Operasional

Q: Jam buka bengkel kapan?
A: Weekday 08:00-17:00, weekend 08:00-16:00.

Q: Kalau chat di luar jam kerja?
A: Sistem tetap terima chat. Untuk kasus tertentu akan diteruskan ke admin untuk follow-up.

## Riwayat Servis

Q: Bisa cek riwayat servis dari nopol?
A: Bisa. Sistem akan cek data service history berdasarkan nomor polisi.

Q: Jika nopol tidak ditemukan?
A: Bot akan minta customer kirim ulang format nopol yang benar.

## Komplain dan Eskalasi

Q: Kalau customer komplain bagaimana?
A: Sistem akan eskalasi ke admin/operator agar ditangani manual.

Q: Apa itu fallback admin?
A: Jika intent tidak dikenali atau jawaban tidak cukup dari knowledge base, chat diteruskan ke admin.

## Dashboard dan Monitoring

Q: Data chat bisa dilihat di mana?
A: Bisa lewat dashboard CRM dan tabel `threads/messages` di backend.

Q: Kenapa chat tidak kebalas?
A: Cek alur WAHA -> bridge -> n8n -> backend -> sendText, lalu gunakan endpoint trace untuk investigasi.

