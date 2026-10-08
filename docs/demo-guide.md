# Panduan demo prototype SIMP

Panduan ini menjalankan alur dari akun sampai laporan. Aplikasi memakai React untuk tampilan, Fastify/TypeScript untuk layanan, dan PostgreSQL untuk menyimpan data. Foto tersimpan pada folder privat. Ini paket demo lokal, belum deployment production.

## 1. Menyalakan aplikasi

Gunakan Node.js seri 24 (minimal 24.15), npm 11 dan PostgreSQL 17. Jalankan dari folder proyek. Pada Windows gunakan PowerShell:

```powershell
npm.cmd ci
npm.cmd run db:local:up
npm.cmd run db:migrate
```

`npm ci` diperlukan ketika baru memasang proyek atau dependency berubah; hentikan aplikasi sebelum menjalankannya. Helper PostgreSQL memakai `C:\Program Files\PostgreSQL\17\bin`, atau lokasi pada environment `PG_BIN`. Helper membuat cluster khusus workspace, database `simp` pada port `55432`, serta `.env` jika belum ada. Helper tidak menimpa `.env` yang sudah ada. Data tetap ada ketika aplikasi dihentikan.

Jika memakai PostgreSQL sendiri, buat database dan akun pemiliknya, salin `.env.example` hanya jika `.env` belum ada, isi koneksi pribadi, lalu lewati `db:local:*`. Tidak perlu membuat database baru setiap demo. Jangan mengganti checksum migration atau mereset database ketika ada error.

Konfigurasi contoh tanpa rahasia:

```dotenv
HOST=127.0.0.1
PORT=3001
DATABASE_URL=postgresql://simp_app:ISI_SENDIRI@127.0.0.1:55432/simp
DATABASE_SCHEMA=public
UPLOAD_DIR=./storage/uploads
PROJECT_TIMEZONE=Asia/Jakarta
APP_ORIGINS=http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:3001,http://localhost:3001
COOKIE_SECURE=false
```

Jika belum ada Administrator, isi `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, dan `BOOTSTRAP_ADMIN_PASSWORD` di `.env` secara pribadi, lalu:

```powershell
npm.cmd run db:bootstrap
npm.cmd run dev
```

Bootstrap tidak mengubah akun yang sudah ada. Setelah berhasil, kosongkan tiga nilai bootstrap dan simpan kata sandi pribadi. Hentikan `dev` sebelum mengedit `.env`, lalu jalankan kembali untuk menghindari dua proses memakai port sama. Email merupakan identitas login biasa; tidak harus akun Google dan tidak melakukan login Google.

- Buka frontend: `http://127.0.0.1:5173`.
- Cek backend: `http://127.0.0.1:3001/api/health`.
- Login, lalu `/api/auth/me` mengembalikan pengguna aktif; tanpa login respons 401 adalah normal.
- pgAdmin: register koneksi ke `127.0.0.1:55432`, database `simp`, gunakan kredensial `.env` pribadi. Buka **Databases → simp → Schemas → public → Tables**.

Untuk mencoba hasil build, hentikan `dev`, jalankan `npm.cmd run build` lalu `npm.cmd start`. Tampilan dan API hasil build tersedia bersama pada `http://127.0.0.1:3001`. Data menggunakan konfigurasi yang sama. Jangan menjalankan dua backend pada port 3001 bersamaan.

## 2. Membuat akun dan proyek demo

1. Login Administrator. Buka **Pengguna → Tambah Pengguna**, buat empat akun aktif: Team Leader, Engineer, Inspector dan Owner. Gunakan nama/email yang Anda tentukan dan kata sandi pribadi; tidak ada kata sandi demo bawaan. Akun tidak membutuhkan pengiriman email.
2. Login TL. Buat proyek dengan kode unik agar dapat diulang tanpa menghapus proyek lama. Nama pekerjaan pada workbook TS!D5: **PEMASANGAN JARINGAN PERPIPAAN TRANSMISI IPA KM 8 KOTA BALIKPAPAN**. Kegiatan TS!D4: **OPTIMALISASI SITEM PENYEDIAAN AIR MINUM (SPAM) JARINGAN PERPIPAAN**. Lokasi Balikpapan, tahun anggaran 2026; ejaan mengikuti workbook.
3. Jadwal contoh workbook adalah 16 Juli–12 Desember 2026 (150 hari inklusif). Pakai tanggal tersebut untuk membaca data sumber. Saat mencoba laporan baru, pilih tanggal dalam jadwal dan tidak melewati hari ini. Jika demo dilakukan di luar jadwal, buat proyek demo lain dengan jadwal yang relevan; perubahan tanggal adalah skenario demonstrasi, bukan salinan jadwal workbook.
4. TL menambahkan Engineer dan Inspector melalui **Tambah Anggota**. Administrator menugaskan Owner ke proyek. Pastikan tanggal penugasan mencakup hari demo.

## 3. Memakai pekerjaan asli workbook TS

1. Buka proyek yang **daftar pekerjaannya masih kosong**, masuk **Daftar Pekerjaan → Lihat Pekerjaan dari Workbook TS**.
2. Periksa 45 baris: **7 kelompok dan 38 item**. Uraian dan hierarki berasal dari TS baris 16–60. Satuan/volume/harga berasal dari M1 baris 19–63. Contohnya Papan Nama Proyek, Galian Tanah (Mekanis), pipa PVC DN-800, serta accessories.
3. Satu volume sumber `622.1201983` disimpan sebagai `622.120198`, mengikuti batas enam desimal aplikasi. Nilai asal terlihat saat pratinjau dan pada keterangan pekerjaan. Bobot dihitung kembali dari volume × harga, bukan disalin dari hasil cache Excel.
4. Klik **Impor Pekerjaan TS ke Proyek Ini**. Muat ulang untuk membuktikan tersimpan di PostgreSQL. Semua baris disimpan dalam satu transaksi dan dicatat dalam audit. Impor ditolak jika sudah ada pekerjaan atau Rencana Awal telah mengunci basis.
5. Periksa angka sebelum menerbitkan rencana. Impor tidak membuat laporan, realisasi, tanda tangan, maupun persetujuan. Formula eksternal dan jadwal berwarna pada TS tidak otomatis dijadikan target aplikasi. Nilai kontrak proyek diisi dari dokumen kontrak yang Anda gunakan; tidak diasumsikan sama dengan jumlah item ditambah PPN.

Sumber data dipaketkan pada `server/templates/workbook-work.json`; frontend membacanya melalui API pratinjau, kemudian data runtime berasal dari PostgreSQL. Jika workbook sengaja diganti, jalankan `node scripts/extract-workbook-work.mjs`, periksa hasilnya, lalu validasi/build ulang. Ini impor khusus workbook contoh, bukan pengunggah Excel umum. Tidak ada proyek lama yang otomatis diisi atau ditimpa.

## 4. Menjalankan workflow lintas role

1. **TL — rencana:** buka Rencana Proyek, buat Rencana Awal. Pilih tiap pekerjaan dan isi target mingguan atau bulanan hingga 100%; gunakan **Bagi Rata Pekerjaan Ini** jika ingin mencoba distribusi rata. Distribusi itu adalah skenario demo yang Anda pilih, bukan target asli TS. Periksa lalu terbitkan. Basis pekerjaan terkunci.
2. **Inspector — laporan:** buat laporan pada tanggal pelaksanaan yang tidak melewati hari ini. Pilih pekerjaan dari TS, isi kegiatan dan volume terukur. Lengkapi tenaga kerja, cuaca, material/alat, masalah serta catatan. Simpan sementara. Untuk demonstrasi, tandai catatan bahwa pengisian laporan merupakan simulasi; jangan menyebut angka simulasi sebagai realisasi lapangan.
3. **Inspector — foto:** unggah JPEG/PNG milik Anda, maksimal 5 MiB dan 20 juta piksel, kaitkan ke kegiatan. Setiap kegiatan dengan volume positif wajib memiliki foto. Klik Periksa Sebelum Kirim, kemudian Kirim untuk Diperiksa.
4. **Engineer:** buka laporan menunggu pemeriksaan, isi catatan teknis. Engineer tidak dapat menyetujui laporan.
5. **TL — perbaikan:** isi alasan lalu Minta Perbaikan. Inspector membuka laporan, memperbaiki isian, menyimpan dan mengirim ulang. Selama belum disetujui, volume tidak masuk progress resmi.
6. **TL — persetujuan:** periksa laporan lalu Setujui Laporan. Progress pekerjaan, laporan mingguan/bulanan dan grafik memakai sumber yang sama. Persetujuan ulang tidak menambah kontribusi dua kali.
7. **Owner:** buka Ringkasan Proyek, grafik, galeri dan laporan berkala. Owner membaca laporan sah dan tidak mendapatkan tombol perubahan teknis. Coba login akun yang tidak ditugaskan: proyek dan ekspornya tidak dapat diakses.
8. **TL — revisi rencana:** buat perubahan dengan alasan, tanggal berlaku yang diizinkan, dan target baru. Rencana Awal tetap tersedia; aktual tidak berubah karena revisi target.
9. **Inspector/TL — koreksi laporan sah:** buat koreksi dengan alasan, ubah volume, kirim dan setujui sebagai TL. Sebelum persetujuan, versi sebelumnya tetap sumber resmi. Sesudah persetujuan, kontribusi diganti, bukan dijumlahkan dengan versi lama. Periksa tautan Versi 1 dan Versi 2.
10. **Ekspor:** buka Ekspor PDF dan Excel, pilih jenis/periode, Tampilkan Pratinjau lalu unduh. Delapan jenis tersedia. Layout mengikuti H0/M1/B1/TS. Matikan pilihan logo jika logo instansi/perusahaan contoh tidak sesuai.

Untuk mengulang demo manual, buat kode proyek baru dan gunakan kembali akun yang sudah ada. Jangan menghapus histori atau mereset database. Untuk demo otomatis yang tidak meninggalkan data bisnis, gunakan perintah tes di bawah.

## 5. Pemeriksaan yang dapat diulang

```powershell
npm.cmd run build
npm.cmd test
$env:PLAYWRIGHT_CHANNEL='msedge'
npm.cmd run test:ui
npm.cmd run test:smoke
```

Microsoft Edge harus tersedia untuk perintah di atas. Playwright Chromium dapat digunakan bila sudah terpasang dengan mengosongkan `PLAYWRIGHT_CHANNEL`. Tidak ada perintah lint dalam manifest; typecheck merupakan bagian build.

Tes otomatis memakai schema PostgreSQL acak `simp_test_*`, akun acak untuk login, direktori foto sementara dan port 3141/5174. Hanya schema/foto yang dibuat runner itu sendiri dibersihkan setelah tes. Data sintetis digunakan khusus pengujian hitungan/akses; data pekerjaan demo manual berasal dari TS. Jangan menjalankan dua runner browser bersamaan.

`tests/browser/acceptance.spec.ts` melakukan seluruh perubahan bisnis melalui formulir lima role, termasuk akun baru; API hanya dipakai untuk pemeriksaan hasil dan percobaan tindakan terlarang. Tes impor workbook tersendiri membuktikan 45 baris tersimpan setelah muat ulang. Smoke menjalankan migration/bootstrap CLI pada schema kosong, lalu me-restart backend development/build dan memeriksa persistensi akun, proyek, rencana, laporan sah, foto serta ekspor. Ini tidak menghentikan layanan PostgreSQL pengguna dan bukan simulasi mati listrik.

## 6. Batas dan kelanjutan

Belum ada uji beban production, backup/pemulihan bencana otomatis, multi-tenant atau layanan email. Cadangan harus mencakup PostgreSQL dan folder foto. Kurva Excel berupa gambar dengan tabel angka; formulir PDF berupa gambar resolusi tinggi dengan lampiran teks. Font/teks panjang dapat berbeda dari Excel, dan seluruh rincian tetap tersedia pada lampiran. PPN/pembulatan dan pengesahan tidak diisi otomatis.

Lihat [hasil penerimaan](acceptance-results.md), [keputusan](decisions.md), [panduan ekspor](ekspor.md) dan [progres](progress.md). Pengembangan berikutnya dimulai dari umpan balik demo yang konkret. Sebelum perubahan schema, buat migration baru; jangan mengubah migration 001–008 yang telah diterapkan.
