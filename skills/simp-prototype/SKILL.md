---
name: simp-prototype
description: Mengerjakan prototype Sistem Informasi Monitoring Proyek (SIMP) secara bertahap berdasarkan prd.md, termasuk database, hak akses, versi rencana, laporan harian, persetujuan, progress, dan ekspor. Gunakan untuk merencanakan, mengimplementasikan, memeriksa, atau melanjutkan tahap SIMP; bukan untuk aplikasi monitoring lain atau pengembangan enterprise.
---

# Pengerjaan prototype SIMP

## Mulai dari keadaan proyek

1. Temukan root proyek yang ditunjuk pengguna. Baca `AGENTS.md` yang berlaku, `prd.md`, `docs/implementation-plan.md`, dan `docs/progress.md` jika tersedia. Lokasi dokumen proyek relatif terhadap root proyek, bukan folder instalasi skill.
2. Periksa struktur, perubahan lokal, manifest, frontend, backend, autentikasi, schema/migration, routing, komponen bersama, dan tes yang relevan. Gunakan kembali yang tersedia. Scaffold hanya komponen yang memang belum ada.
3. Bila dokumen rencana belum tersedia, susun tahapan dari PRD §64 dan §83, dengan keluaran serta kriteria lulus. Bila PRD tidak tersedia, minta lokasinya sebelum mengarang kebutuhan SIMP.
4. Pilih tahap belum selesai paling awal yang dependensinya terpenuhi. Cocokkan catatan dengan kode dan bukti tes; jangan menganggap checklist sebagai bukti implementasi.

## Sesuaikan dengan permintaan

- **Analisis/rencana:** hasilkan dokumen dan keputusan terbuka; jangan otomatis membangun aplikasi.
- **Kerjakan tahap N:** selesaikan cakupan tahap tersebut beserta tes dan catatan progres. Jika ada dependensi belum selesai, kerjakan prasyarat yang diperlukan dalam lingkup permintaan atau jelaskan hambatan konkretnya.
- **Lanjutkan:** jalankan tahap berikutnya hingga memenuhi kriteria lulus.
- **Kerjakan sampai selesai:** lanjutkan antar tahap tanpa meminta persetujuan rutin; berhenti hanya pada batas otorisasi, hambatan eksternal nyata, atau batas eksekusi. Simpan titik lanjut jika sesi berakhir.
- **Tinjau:** periksa implementasi terhadap PRD dan tes, lalu laporkan temuan dengan lokasi dan dampaknya; jangan menandai fitur selesai hanya berdasarkan tampilan.

## Cara mengerjakan satu tahap

1. Nyatakan tujuan tahap, batas perubahan, dan asumsi bisnis yang memengaruhinya. Baca bagian PRD terkait; untuk perhitungan, periode, versioning, atau pemeriksaan baca [aturan domain](references/domain-rules.md).
2. Selesaikan satu alur yang bisa digunakan: migration/data → service backend → authorization/validasi → API → UI → pengujian. Gunakan transaksi untuk perubahan status yang terkait dengan posting progress.
3. Semua data bisnis runtime berasal dari database. Seed sintetis boleh untuk pengujian/demo dan harus disimpan melalui mekanisme aplikasi/seed resmi, bukan array UI atau localStorage sebagai database.
4. Tetapkan satu service perhitungan untuk ringkasan, laporan, grafik, dan ekspor. Jangan menghitung ulang sejarah aktual memakai rencana terbaru.
5. Tulis pengujian perilaku kritis sesuai PRD §80 serta kriteria tahap. Jalankan perintah yang benar-benar ada di repository. Perbaiki kegagalan terkait perubahan sebelum lanjut.
6. Perbarui `docs/progress.md`: status, perubahan, migration, perintah tes dan hasil aktual, keterbatasan, keputusan, serta langkah berikutnya. Jangan menyimpan kata sandi/token. Bedakan tes lulus, gagal, dan belum dijalankan.
7. Laporkan hasil singkat beserta cara mencoba fitur dan hambatan yang tersisa. Jika lingkupnya sampai selesai, lanjut ke tahap berikutnya setelah bukti kelulusan tersedia.

## Aturan yang tidak boleh hilang saat menyederhanakan prototype

- PRD adalah acuan fitur; instruksi pengguna terbaru mengendalikan cakupan. Asumsi tambahan dalam dokumen bukan kutipan PRD dan boleh diperbaiki dengan alasan tercatat.
- Lima role tetap berlaku. Administrator tidak menyetujui laporan teknis; persetujuan akhir oleh Team Leader proyek. Cek hak akses dan penugasan di backend untuk data, foto, dan ekspor.
- Hanya laporan yang disetujui berkontribusi pada progress resmi. Pengiriman atau persetujuan ulang tidak boleh menggandakan progress.
- Rencana Awal dan versi lama dipertahankan. Revisi laporan yang disetujui harus eksplisit, beralasan, dan menyimpan jejak versi; tidak ada silent overwrite.
- Minggu dihitung sejak tanggal mulai proyek. Persen, bobot, batas tanggal, pembulatan, dan sumber progress memakai kontrak yang sama.
- Semua teks UI termasuk validasi/status/notifikasi berbahasa Indonesia sesuai PRD §5. Form bertahap, nyaman di HP, dan memiliki kondisi memuat/kosong/gagal/berhasil.
- Pisahkan frontend dari service/backend secara jelas. Gunakan TypeScript, migration, hash password, validasi input dan upload, serta konfigurasi rahasia di luar kode.
- Tidak menambah multi-tenant, ERP, notifikasi eksternal, aplikasi native, offline-first, atau fitur §63. Hindari microservices dan infrastruktur enterprise tanpa kebutuhan nyata.
- Ketiadaan workbook Excel menghambat validasi kesamaan template, bukan pembangunan workflow dari PRD. Nyatakan keterbatasan itu.

## Selesai berarti bisa dibuktikan

Gunakan PRD §79–82 serta kriteria tahap, bukan jumlah halaman yang dibuat. Akhir prototype mencakup semua P0–P3, PDF/Excel, alur lintas role tanpa manipulasi database manual, pengujian perhitungan dan histori, serta petunjuk menjalankan demo. Jangan menyebut prototype siap production.
