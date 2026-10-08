# SIMP — Prototype

Panduan demo lengkap: [docs/demo-guide.md](docs/demo-guide.md). Bukti penerimaan akhir: [docs/acceptance-results.md](docs/acceptance-results.md). Untuk data pekerjaan contoh, gunakan **Daftar Pekerjaan → Lihat Pekerjaan dari Workbook TS** pada proyek kosong: 7 kelompok dan 38 item dari workbook, disimpan ke PostgreSQL setelah dikonfirmasi.

Prototype Sistem Informasi Monitoring Proyek berdasarkan [PRD](prd.md). T00–T11 menyediakan login/pengguna, proyek/tim, pekerjaan/bobot, rencana terversi, laporan harian, foto privat, pemeriksaan, persetujuan, koreksi terversi, kemajuan resmi, rekap, dokumentasi, riwayat, serta delapan keluaran web/PDF/XLSX. Setelah masuk, pilih proyek lalu gunakan delapan tujuan langsung: **Ringkasan**, **Laporan Harian**, **Rekap & Unduhan**, **Daftar Pekerjaan**, **Jadwal & Target**, **Dokumentasi**, **Tim**, dan **Informasi Proyek**. Panduan navigasi ada di [docs/ui-ux.md](docs/ui-ux.md), pedoman visual ada di [docs/design-system.md](docs/design-system.md), dan penjelasan bobot serta kurva-S ada di [docs/Penjelasan-rumus.md](docs/Penjelasan-rumus.md).

## Menjalankan lokal

Prasyarat: Node.js 24.15 atau lebih baru dalam seri 24, npm 11, dan PostgreSQL 17. Versi yang diuji: Node 24.19.0, npm 11.17.0, PostgreSQL 17.11. Jalankan perintah dari root repository.

Pada Windows, helper menggunakan instalasi `C:\Program Files\PostgreSQL\17\bin`. Untuk lokasi lain, isi environment `PG_BIN` dengan direktori bin PostgreSQL.

```powershell
npm.cmd ci
npm.cmd run db:local:up
npm.cmd run db:migrate
npm.cmd run dev
```

Aplikasi tersedia di `http://127.0.0.1:5173`, API lokal di `http://127.0.0.1:3001/api/health`. Hentikan aplikasi dengan Ctrl+C. Pada shell selain PowerShell, gunakan `npm`.

`db:local:up` menyiapkan dan menjalankan cluster khusus workspace pada **127.0.0.1:55432**, database `simp`, akun aplikasi `simp_app`. Cluster memakai autentikasi SCRAM; akun aplikasi bukan superuser dan tidak memiliki izin membuat role/database. Layanan PostgreSQL lain di komputer tidak diubah.

Saat pertama kali dijalankan, helper membuat password acak dan menulis `.env` lokal. Tidak ada password bawaan dan rahasia tidak dicetak. Helper tidak menimpa `.env` yang sudah ada. Cluster/data berada di `data/postgres/`, kredensial pengelolaan lokal di `data/postgres-local.json`; seluruhnya diabaikan Git. Jangan membagikan folder data atau `.env`.

```powershell
npm.cmd run db:local:status
npm.cmd run db:local:down
```

Perintah `down` menghentikan cluster milik workspace tanpa menghapus data. Jalankan `up` kembali setelah komputer restart; helper tidak mendaftarkan Windows service baru.

Untuk memakai PostgreSQL yang Anda kelola sendiri, siapkan database dan akun pemiliknya, salin `.env.example` menjadi `.env` jika belum ada, lalu isi `DATABASE_URL`. Lewati perintah `db:local:*`. URL harus menggunakan protokol `postgresql://` atau `postgres://`; `DATABASE_SCHEMA` default `public`. Untuk server jarak jauh, gunakan konfigurasi TLS yang memvalidasi sertifikat sesuai penyedia.

Foto berada di `storage/uploads` (atau `UPLOAD_DIR`) dan tidak disajikan sebagai berkas publik. Akses foto melalui API dengan pemeriksaan sesi, proyek dan hak laporan. Server menerapkan migration PostgreSQL baru sebelum menerima permintaan.

## Bootstrap Administrator

Isi `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, dan `BOOTSTRAP_ADMIN_PASSWORD` pada `.env` lokal. Gunakan kata sandi 12–128 karakter; tidak ada akun/kata sandi bawaan. Akun Administrator aplikasi berbeda dari akun database `simp_app`.

```powershell
npm.cmd run db:bootstrap
```

Perintah menyimpan hash, bukan kata sandi plaintext. Pengulangan dengan email Administrator aktif yang sama tidak mengubah data/password. Email akun dengan role berbeda atau akun nonaktif ditolak. Hapus nilai bootstrap dari `.env` setelah berhasil.

## Mencoba T01

1. Jalankan bootstrap Administrator di atas, lalu `npm.cmd run dev`.
2. Buka `http://127.0.0.1:5173/masuk`, masuk dengan email dan kata sandi yang Anda isi saat bootstrap.
3. Administrator membuka **Pengguna** untuk membuat/mengubah akun, mengganti role, serta mengaktifkan/nonaktifkan akun. Email harus unik; kata sandi awal minimal 12 karakter. Kata sandi edit boleh dikosongkan agar tetap sama.
4. Keluar lalu masuk memakai akun Owner, Team Leader, Engineer atau Inspector untuk melihat ruang kerja sesuai role. Daftar global pengguna hanya tersedia bagi Administrator; API juga menolak akses langsung peran lain.

Sesi berlaku 8 jam. Perubahan role/status/kata sandi mengakhiri semua sesi pengguna terkait; perubahan sensitif meminta konfirmasi. Minimal satu Administrator harus tetap aktif. Pengelolaan proyek tersedia pada T02; laporan masih tahap berikutnya.

`APP_ORIGINS` berisi alamat halaman aplikasi yang diizinkan mengirim login dan perubahan data, dipisahkan koma. Default mencakup localhost/127.0.0.1 port 5173 dan 3001. Jika port/hostname berubah, sesuaikan konfigurasi lalu restart backend. `COOKIE_SECURE=false` untuk HTTP lokal; saat memakai HTTPS gunakan `true`. Contoh konfigurasi tanpa rahasia ada di [.env.example](.env.example).

## Mencoba T02

1. Masuk sebagai Administrator, buat akun Team Leader serta anggota yang diperlukan melalui **Pengguna**.
2. Buka **Proyek → Tambah Proyek**. Isi identitas/pihak terkait, kontrak/jadwal, lalu periksa ringkasan dan simpan. Administrator dapat memilih TL; TL yang membuat proyek menjadi penanggung jawab otomatis sejak hari pembuatan.
3. Pilih proyek lalu buka **Tim & Informasi → Tim** untuk menugaskan Engineer/Inspector; Administrator juga dapat menugaskan Owner. Pilih periode mulai/akhir dan status aktif. Administrator mengatur periode TL melalui **Ubah Penugasan** pada TL yang ditetapkan.
4. Masuk dengan akun anggota. Daftar/detail/tim hanya tersedia jika akun, role, periode, dan penugasannya memenuhi aturan. Perubahan penugasan langsung berlaku pada permintaan berikutnya; tidak perlu logout terlebih dahulu.
5. Gunakan **Koreksi Status** dengan alasan untuk menetapkan Selesai/Ditutup atau kembali otomatis. Status otomatis memakai progress sah dan jadwal rencana efektif.
6. **Arsipkan Proyek** meminta alasan dan konfirmasi. Proyek menjadi hanya-baca dan hilang dari daftar utama; aktifkan **Sertakan arsip** untuk membukanya kembali. Data/tim/audit dipertahankan.

Pengelola dapat mengubah informasi dan mencari proyek berdasarkan nama, kode, nomor kontrak atau lokasi, serta menyaring status. Nilai kontrak diisi tanpa pemisah ribuan, misalnya `1000000,50`; durasi tanggal mulai–selesai dihitung inklusif. Masa penugasan boleh mencakup persiapan sebelum jadwal atau penutupan sesudahnya. Owner/Engineer/Inspector tidak dapat mengubah informasi proyek.

## Mencoba T03

1. Masuk sebagai Administrator/TL, pilih proyek, lalu buka **Rencana Pekerjaan → Daftar pekerjaan**.
2. Gunakan **Tambah Kelompok** untuk wadah bertingkat. Pilih kelompok induk bila diperlukan. Kelompok tidak memiliki volume/harga sendiri.
3. Gunakan **Tambah Pekerjaan** untuk item: isi kode, nama, kelompok, satuan, volume dan harga. Volume maksimal 6 desimal, harga 2 desimal, tanpa pemisah ribuan; koma desimal diterima form.
4. Setelah simpan, nilai dan bobot dihitung otomatis. Kelompok menampilkan agregat; total hanya menjumlah item. Status nonaktif tetap termasuk basis kontrak.
5. Coba ubah volume/harga dan muat ulang untuk melihat persistensi. Penghapusan meminta konfirmasi dan ditolak bila kelompok masih memiliki turunan atau item sudah dirujuk.

Tanggal pekerjaan boleh dikosongkan bersama atau diisi di dalam jadwal proyek. Total nilai nol menampilkan peringatan karena bobot belum dapat dihitung. Pembulatan tampilan dua desimal tidak mengubah perhitungan presisi penuh; perbedaan total bobot tampilan >0,01 poin diberi peringatan.

Owner/Engineer/Inspector yang ditugaskan hanya dapat membaca. Penerbitan Rencana Awal pada T04 mengaktifkan penguncian basis; sesudahnya gunakan revisi rencana untuk mengubah target/jadwal.

## Mencoba T04

1. Masuk sebagai **TL proyek**, pilih proyek lalu buka **Rencana Pekerjaan → Jadwal & target**. Lengkapi pekerjaan dengan total nilai positif terlebih dahulu.
2. Pilih **Buat Rencana Awal**. Isi identitas/alasan dan pilih sumber target **Mingguan** atau **Bulanan**. Rencana Awal memakai jadwal proyek dan berlaku sejak tanggal mulai.
3. Pada langkah target, pilih setiap pekerjaan dan isi tambahan target fisik tiap periode. Jumlah setiap pekerjaan harus tepat **100%**, maksimal enam desimal. Tombol **Bagi Rata Pekerjaan Ini** membantu mengisi pekerjaan yang dipilih.
4. Periksa ringkasan, lalu **Tetapkan Rencana**. Volume, harga, satuan dan struktur pekerjaan terkunci. Rencana yang sudah ditetapkan tidak bisa diubah atau dihapus.
5. Gunakan **Buat Perubahan Rencana** untuk target/jadwal baru. Alasan wajib; tanggal berlaku harus setelah versi terakhir dan tidak sebelum hari ini. Tanggal mulai tetap; tanggal selesai boleh berubah. Mengganti jadwal/sumber periode meminta pengisian target ulang.
6. Gunakan tanggal pemeriksaan untuk melihat versi yang berlaku. Versi masa depan belum aktif. Pilih dua versi untuk membandingkan target proyek atau rincian per pekerjaan; tampilan mingguan/bulanan berasal dari alokasi harian yang sama.

Jadwal kontrak pada informasi proyek tetap tersimpan; jadwal pelaksanaan revisi ada pada masing-masing versi rencana. Minggu dimulai pada tanggal mulai proyek, bukan Senin; bulan mengikuti tanggal mulai dengan penyesuaian akhir bulan. Target dibagi merata per hari dalam periode sumber. Angka tampilan dibulatkan, tanpa mengubah sumber perhitungan.

Admin/Owner/Engineer/Inspector hanya membaca rencana sesuai hak proyek. Form yang belum diterbitkan belum tersimpan; jangan menutup halaman sebelum menerbitkan. Batas prototype: 3.660 hari, 500 item pekerjaan dan 20.000 isian target per versi. Progress aktual tersedia melalui laporan yang disetujui TL; lihat petunjuk T07 di bawah.

## Mencoba T05

1. Pastikan proyek memiliki Rencana Awal yang sudah ditetapkan serta penugasan Inspector/TL yang aktif. Masuk sebagai salah satu peran tersebut, pilih proyek lalu buka **Laporan → Harian → Buat Laporan Harian**.
2. Isi tanggal dan minimal satu kegiatan. Tanggal tidak boleh melewati hari ini dan harus berada pada jadwal versi yang berlaku pada tanggal tersebut. Pilih item pekerjaan untuk volume kuantitatif; satuan mengikuti basis. Volume boleh kosong untuk kegiatan naratif. Jumlah volume per pekerjaan dalam satu laporan tidak boleh melebihi kontraknya.
3. Lengkapi tenaga kerja per jenis/jam/identitas opsional, cuaca, material/alat, masalah, serta catatan. Malam boleh tidak diisi. Material ditolak memerlukan alasan. Tanggal material/masalah sama dengan tanggal laporan; jam cuaca tidak melintasi tengah malam.
4. Klik **Simpan Sementara**. Nomor laporan, identitas proyek, hari/minggu/durasi/sisa hari ditampilkan otomatis. Draf dapat dibuka ulang dan diedit pembuatnya; satu laporan per proyek/tanggal/pembuat.
5. Pada detail laporan, unggah foto terkait kegiatan: JPEG/PNG maksimal **5 MiB**, maksimal **20 juta piksel**, maksimal **20 foto per laporan**. Isi keterangan dan lokasi bila tersedia. Tanggal foto mengikuti laporan; server memvalidasi isi serta menyimpan ulang JPEG tanpa metadata bawaan.
6. Setiap kegiatan dengan volume positif wajib memiliki minimal satu foto. Pilih **Periksa Sebelum Kirim**, periksa seluruh rincian/foto, lalu **Kirim untuk Diperiksa**. Status berubah menjadi **Menunggu Pemeriksaan** dan edit/unggah/hapus terkunci. Lanjutkan pemeriksaan dengan petunjuk T06 di bawah.
7. Buka **Dokumentasi**, lalu pilih pekerjaan untuk melihat foto yang terhubung dan dapat Anda akses.

Inspector hanya mengakses laporannya sendiri. Admin/TL/Engineer dapat membaca laporan dalam cakupan proyek, tetapi hanya pembuat TL/Inspector yang mengedit drafnya. Owner hanya membaca laporan/foto berstatus Sudah Disetujui. Menghapus draf menghapus rincian dan foto terkait dengan jejak audit; laporan terkirim tidak dapat dihapus. Perubahan serentak ditolak dengan permintaan muat ulang.

Untuk mengganti tanggal atau kegiatan/pekerjaan yang sudah memiliki foto, hapus foto terkait terlebih dahulu. Batas volume kumulatif diperiksa saat kirim/setujui pada T06; perhitungan progress resmi tersedia pada T07. Form tidak memiliki autosave. Backup aplikasi kelak harus mencakup database **dan** folder unggahan.

## Mencoba T06

1. Jalankan `npm.cmd run db:migrate` untuk menerapkan migration terbaru, kemudian jalankan aplikasi. Pilih proyek lalu buka **Laporan → Harian**. Antrean awal Team Leader dan Engineer menampilkan laporan yang menunggu pemeriksaan; filter lain tersedia melalui **Filter laporan**.
2. Engineer proyek membuka laporan terkirim dan menyimpan **Catatan pemeriksaan teknis**. Catatan ini tidak memutuskan persetujuan.
3. TL proyek membuka laporan lalu memilih **Setujui Laporan** atau **Minta Perbaikan**. Perbaikan wajib memiliki alasan. Pembuat membuka laporan **Perlu Diperbaiki**, mengubah isian/foto lalu mengirim ulang.
4. Sesudah disetujui, Owner dapat membaca laporan dan fotonya. Untuk koreksi, pembuat aktif membuka versi sah terakhir, mengisi **Alasan koreksi**, lalu **Buat Koreksi**. Edit dan kirim versi baru untuk persetujuan TL.
5. Buka **Versi laporan** untuk melihat versi lama. Sampai koreksi disetujui, versi lama tetap menjadi sumber resmi; sesudah itu versi baru menggantikannya. Foto lama tetap dapat dibuka.

Admin tidak menyetujui laporan teknis. Klik ganda atau perubahan pada tab lain dapat menghasilkan pesan muat ulang; keputusan tidak digandakan. Volume kumulatif saat kirim/setujui tidak boleh melebihi kontrak. Koreksi mempertahankan tanggal/nomor/pembuat dan tidak dapat dihapus. T07 menghitung progress dari sumber sah ini.

## Build dan verifikasi

```powershell
npm.cmd run build
npm.cmd start
```

Hasil build menyajikan UI/API pada `http://127.0.0.1:3001`. PostgreSQL tetap harus berjalan. Build ini untuk demo lokal dan bukan klaim siap production.

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:smoke
```

Tes memakai PostgreSQL nyata dari `DATABASE_URL`, dengan schema acak `simp_test_*` yang dibersihkan setelah selesai. Akun tes memerlukan izin membuat schema pada database tersebut. Tes tidak memakai SQLite, mock database, atau menghapus schema `public`. Gunakan database development khusus jika mengatur koneksi sendiri.

`test:smoke` membutuhkan hasil build dan menjalankan migration, bootstrap, login Admin/TL, pembuatan proyek/pekerjaan/Rencana Awal/laporan/foto, server development, restart server hasil build, persistensi seluruh data tersebut, routing UI serta penolakan foto tanpa sesi dan berkas privat. Tes tidak membuat akun di schema bisnis utama.

Untuk tes browser pada Windows dengan Microsoft Edge terpasang:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm.cmd run test:ui
```

Untuk Chromium Playwright, jalankan `npx.cmd playwright install chromium` jika belum tersedia dan biarkan `PLAYWRIGHT_CHANNEL` kosong. Tes browser membutuhkan port 3141/5174 kosong dan menggunakan schema PostgreSQL tersendiri. Runner membuat lima akun sintetis, proyek, dan penugasan melalui service aplikasi dengan password acak sementara, lalu membersihkan schema. Screenshot/trace berada di `test-results/`.

## Peralihan dari SQLite

Database lama `data/simp.sqlite` dan migration SQLite lama dipertahankan sebagai arsip. Pemeriksaan sebelum perpindahan menunjukkan nol pengguna, proyek, penugasan dan audit; tidak ada data bisnis yang perlu disalin. Runtime sekarang hanya menggunakan PostgreSQL.

Migration aktif berada di `server/db/migrations/postgresql/`. Jangan menerapkan SQL SQLite lama ke PostgreSQL. Jika memakai salinan proyek yang sudah memiliki data bisnis SQLite, diperlukan proses impor data tersendiri; helper lokal tidak melakukan konversi otomatis.

Detail: [arsitektur](docs/architecture.md), [keputusan prototype](docs/decisions.md), [rencana tahap](docs/implementation-plan.md), [hasil dan progres](docs/progress.md).


Ekspor T10: pilih proyek lalu buka **Laporan → Rekap** untuk membaca hasil dan mengakses delapan jenis keluaran. Lihat [panduan ekspor](docs/ekspor.md) untuk format, batas presisi dan perbandingan workbook contoh.

Formulir ekspor kini mengikuti layout workbook H0/M1/B1/TS, termasuk kop, kelompok kolom dan pengaturan cetak. Logo contoh dapat dinonaktifkan pada formulir ekspor.
#   S I M P  
 