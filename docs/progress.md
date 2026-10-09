# Progres implementasi SIMP

Terakhir diperbarui: 8 Oktober 2026.

## Keadaan saat ini

- **T00–T11 selesai serta tervalidasi menggunakan PostgreSQL.** Login/pengguna, proyek/tim, pekerjaan/bobot, rencana terversi, laporan harian lengkap, foto privat, pemeriksaan Engineer, keputusan TL, koreksi terversi, progress resmi, laporan mingguan/bulanan, ringkasan role, grafik, galeri berfilter, riwayat, delapan ekspor web/PDF/XLSX serta filter laporan lengkap sudah tersedia.
- Database utama kini PostgreSQL `simp` pada `127.0.0.1:55432`, memakai akun `simp_app`. Lima role referensi tersedia; Administrator pertama telah dibuat melalui bootstrap dari konfigurasi pengguna pada 30 September 2026.
- `.env` lokal berisi koneksi database. Bootstrap Administrator pertama sudah berhasil dan login melalui frontend sudah diverifikasi. Kosongkan nilai `BOOTSTRAP_ADMIN_*` setelah menyimpan kredensial secara pribadi; akun tetap tersimpan di database. Gunakan `npm.cmd run db:local:up` setelah komputer restart.
- Database SQLite lama tetap ada sebagai arsip, tidak digunakan runtime.
- **T11 selesai — validasi akhir dan paket demo tersedia.** Langkah berikutnya adalah menjalankan demo dan mencatat umpan balik pengguna. Ringkasan, kurva, laporan dan status otomatis memakai sumber progress yang sama. Tidak ada migration baru pada T07–T11; checksum/history 001–008 tetap sama.
- Layout utama web/PDF/XLSX kini mengikuti workbook `LAPORAN PROYEK contoh.xlsx`: kop, kolom, gabungan sel, warna, dan pengaturan cetak H0/M1/B1/TS. Data tetap berasal dari aplikasi; aturan periode aplikasi dipertahankan dan formula eksternal tidak dihitung dari cache. Rincian serta batas tampilan dicatat di docs/ekspor.md.
- Perbaikan setelah T11 menambahkan **Nama kontraktor** pada tambah/ubah/detail proyek dan laporan/ekspor. Migration `009_project_contractor.sql` sudah diterapkan; 001–008 tetap utuh. Kolom proyek lama awalnya kosong dan dapat diisi melalui Ubah Proyek.
- **Redesign UI/UX prototipe selesai diterapkan pada frontend.** Navigasi global dan konteks proyek dipadatkan, dashboard mengutamakan pekerjaan yang perlu perhatian, status/angka/form/tabel/keadaan kosong/loading diseragamkan, konfirmasi browser diganti modal yang dapat diakses, serta tampilan HP memakai menu samping dan pemilih bagian proyek. Pedoman baru tersedia di [design-system.md](design-system.md). Tidak ada perubahan database, migration, API, route, role, permission, perhitungan, atau format ekspor.
- **Beranda Team Leader diperbarui dari referensi tampilan.** Proyek terpilih, KPI, tindakan, dua grafik, foto terbaru, dan tabel proyek kini berada dalam alur baca yang jelas; tabel dapat dicari. Tampilan sudah diperiksa pada desktop, tablet, HP, dan pembesaran 200%.

## Status tahap

| Tahap | Status | Bukti |
| --- | --- | --- |
| T00 | Selesai | PostgreSQL: build/typecheck, 14 tes backend, restart database/aplikasi, 4 tes browser lulus; rincian di bawah |
| T01 | Selesai | 19 tes backend, 16 tes browser desktop/HP, build/typecheck dan smoke sesi lintas restart lulus; rincian di bawah |
| T02 | Selesai | 26 tes backend, pemeriksaan ulang 7 tes T02, 22 tes browser, build/typecheck dan smoke persistensi proyek lintas restart lulus |
| T03 | Selesai | 37 tes backend, 26 tes browser, build/typecheck dan smoke persistensi pekerjaan/bobot lintas restart lulus; rincian di bawah |
| T04 | Selesai | 46 tes backend, 30 tes browser desktop/HP, build/typecheck dan smoke persistensi baseline/target lintas restart lulus |
| T05 | Selesai | 51 tes backend, 34 tes browser desktop/HP, build/typecheck dan smoke persistensi laporan/foto lintas restart lulus |
| T06 | Selesai | 57 tes backend, 34 regresi browser + 2 tes T06 desktop/HP, build/typecheck dan smoke lulus; migration 007→008 tanpa perubahan history/data lama |
| T07 | Selesai | 64 tes backend, 38 tes browser desktop/HP, build/typecheck dan smoke restart lulus; checksum/history 8 migration tidak berubah |
| T08 | Selesai | 66 tes backend, 40 tes browser desktop/HP, build/typecheck dan smoke restart lulus; 2 tes T08 diulang lulus setelah pemeriksaan akhir |
| T09 | Selesai | 68 tes backend, 42 tes browser, build dan smoke lulus; 2 tes backend T09 serta 6 browser terkait diulang lulus setelah perbaikan akhir |
| T10 | Selesai | Penyesuaian layout workbook 1 Oktober: 72 tes lulus; 4 tes ekspor/layout terarah dan 2 tes layout akhir lulus; 6 browser desktop/HP, build serta smoke lulus. Riwayat validasi awal tetap dicatat di bawah |
| T11 | Selesai | 74/74 tes lulus; regresi awal 46/48 lalu 10/10 browser terkait lulus setelah perbaikan; build/smoke lulus; 8 checksum migration cocok; panduan demo dan hasil penerimaan tersedia |

Status yang digunakan: Belum dimulai, Dikerjakan, Terhambat, Selesai. Status selesai membutuhkan bukti yang mengacu pada keluaran dan kriteria tahap.

**Cara membaca:** status terbaru ada pada tabel di atas. Entri di bawah disusun kronologis; bagian “Titik lanjut” pada entri lama adalah riwayat pada saat tahap tersebut dikerjakan, bukan status terbaru.

## Catatan sesi implementasi

### 28 September 2026 — T00 awal menggunakan SQLite (riwayat)

**Hasil:** fondasi berjalan secara lokal dengan sumber data SQLite nyata. Semua kriteria T00 terpenuhi; belum ada klaim kelulusan fitur T01–T11.

**Berkas utama:**

- [README](../README.md): setup, konfigurasi, bootstrap, dev/build dan tes.
- [Arsitektur](architecture.md): versi stack, struktur kode, desain relasi, sesi login yang direncanakan, dan penyimpanan foto.
- [Keputusan](decisions.md): pilihan teknis serta asumsi periode/bobot/revisi/rencana/zona waktu untuk tahap berikutnya.
- `server/db/migrations/001_identity_projects.sql`: roles, users, projects, project_members, audit_events; FK/constraint dan durasi otomatis.
- `server/db/migrate.ts`: migration transaksional dan checksum, aman diulang, menolak perubahan migration lama.
- `server/services/bootstrap-admin.ts`, `server/security/password.ts`: akun awal dari konfigurasi, scrypt, idempotensi dan audit tanpa rahasia.
- `server/app.ts`, `client/src/App.tsx`: endpoint kesehatan database dan halaman awal Indonesia dengan keadaan memuat/berhasil/gagal serta coba ulang.
- `tests/`, `scripts/smoke.mjs`, `playwright.config.ts`: pengujian fondasi dan browser nyata.

**Migration:** `npm.cmd run db:migrate` menerapkan satu migration baru pada database utama. Saat startup, migration tertunda juga diterapkan sebelum server listen. Tes mengulang migration tanpa perubahan dan membuktikan kegagalan SQL membatalkan seluruh transaksi.

**Bukti verifikasi:**

| Pemeriksaan/perintah | Hasil aktual |
| --- | --- |
| Instalasi dependensi npm | Berhasil; versi exact dan package-lock tersimpan |
| `npm.cmd run build` | Lulus; mencakup typecheck frontend, backend, konfigurasi browser dan tes; UI/server/migration dihasilkan |
| `npm.cmd test` | 11/11 lulus; database file nyata, FK/tanggal/uang, rollback/checksum, hash/bootstrap, API/error/config |
| `npm.cmd run db:migrate` | Lulus pada DB lokal baru; 1 migration diterapkan |
| `npm.cmd run test:smoke` | Lulus; migration dan bootstrap CLI, server development, hasil build, dua startup hasil build, persistensi akun/audit dan `integrity_check=ok` |
| Persistensi proyek setelah koneksi dibuka ulang | Lulus dalam tes database: nama proyek dan durasi 8 hari tetap benar |
| `PLAYWRIGHT_CHANNEL=msedge` lalu `npm.cmd run test:ui` | 4/4 lulus; ukuran 1280×900 dan 390×844, backend melalui proxy Vite, retry setelah respons 503 |
| Pemeriksaan browser | Tidak ada page error pada alur sukses, tidak ada overflow horizontal; screenshot desktop/HP diperiksa |
| Akses berkas privat | Permintaan `.env` dan file storage tidak tersedia publik; route API tidak dikenal tetap 404 |
| Audit dependensi setelah perbaikan | npm melaporkan 0 vulnerabilities pada instalasi versi akhir |
| Lint | Belum dikonfigurasi/dijalankan; tidak diklaim lulus |

Screenshot tersimpan di `test-results/home-halaman-terhubung-ke-backend-nyata-pada-komputer-dan-HP-desktop/halaman-awal.png` dan direktori padanan `-phone/`. Berkas hasil tes diabaikan Git.

**Kendala yang sudah diselesaikan:** akses npm registry diblokir sandbox dan dijalankan ulang dengan izin. Loader TypeScript juga gagal di sandbox Windows pada `uv_os_get_passwd`; pengujian dijalankan ulang di luar sandbox dan lulus. Kesalahan typing handler Fastify diperbaiki. Temuan npm audit pada versi awal `@fastify/static` diselesaikan dengan versi 10.1.5; build dan smoke diuji ulang setelah upgrade.

**Batas hasil:** bootstrap diuji memakai database sementara dan password acak/fixture; kredensial pribadi tidak dibuat atau dicetak. Untuk Administrator pada DB utama, isi `.env` lokal lalu jalankan `npm.cmd run db:bootstrap`. Login/authorization bisnis, CRUD proyek, unggah foto dan perhitungan progress belum termasuk T00. SQLite lokal belum diuji untuk skala production. Workbook baru dibaca daftar lembarnya, bukan rumus/layout.

**Titik lanjut:** mulai T01 dengan migration sesi dan service autentikasi berdasarkan strategi pada arsitektur; implementasikan login/logout, pembatasan role backend, akun nonaktif, dan pengelolaan pengguna Administrator. Pertahankan database/migration T00 serta seluruh tes yang sudah lulus.

### 28 September 2026 — Peralihan T00 ke PostgreSQL

**Permintaan:** pengguna memilih PostgreSQL sebelum melanjutkan T01. Catatan SQLite di atas adalah riwayat; konfigurasi aktif mengikuti entri ini.

**Perubahan:**

- Driver `pg` 8.23.0 dan tipe 8.23.1; koneksi pool dan seluruh query/service/CLI menjadi asinkron.
- Transaksi memakai satu PoolClient. Advisory lock mencegah migration dan bootstrap ganda saat dijalankan bersamaan.
- Migration baru `server/db/migrations/postgresql/001_identity_projects.sql` dengan DATE, TIMESTAMPTZ, BOOLEAN, BIGINT, FK, indeks unik email tanpa membedakan kapital, serta durasi proyek otomatis.
- PostgreSQL 17.11 yang sudah terpasang dipakai untuk cluster workspace tersendiri pada `data/postgres`, port 55432, autentikasi SCRAM. Layanan Windows PostgreSQL existing tetap berjalan dan tidak diubah.
- `db:local:up/down/status` mengelola cluster workspace. `.env` berisi DATABASE_URL lokal; rahasia tidak dicetak atau masuk Git. Bootstrap Administrator aplikasi masih memerlukan isian pengguna, terpisah dari kredensial database.
- Tes backend, smoke dan browser seluruhnya memakai PostgreSQL nyata dengan schema sementara acak; schema bisnis `public` tidak dipakai untuk fixture.
- [README](../README.md), [arsitektur](architecture.md), dan [keputusan](decisions.md) diperbarui.

**Perlindungan data:** pemeriksaan hanya-baca terhadap SQLite sebelum perpindahan menunjukkan `users=0`, `projects=0`, `project_members=0`, `audit_events=0`. Tidak diperlukan impor bisnis. Database dan migration SQLite awal dipertahankan utuh; tidak ada konversi atau penghapusan otomatis terhadap berkas lama.

| Pemeriksaan/perintah | Hasil aktual |
| --- | --- |
| Instalasi `pg` dan `@types/pg` | Berhasil, lockfile diperbarui; npm melaporkan 0 vulnerabilities |
| `npm.cmd run db:local:up` | Cluster lokal siap, akun dan database khusus tersedia, .env dibuat tanpa mencetak password |
| `npm.cmd run db:migrate` | 1 migration PostgreSQL diterapkan pada database baru |
| `npm.cmd run build` | Typecheck dan build frontend/backend/tes lulus |
| `npm.cmd test` | 14/14 lulus; mencakup transaksi dan isolasi koneksi, migration/bootstrap bersamaan, constraint, persistensi, hash dan API |
| `db:local:down` → `db:local:up` → `db:migrate` | Restart PostgreSQL berhasil; 0 migration baru setelah restart, schema/data tetap ada |
| `npm.cmd run test:smoke` | CLI bootstrap, server development, hasil build dan dua startup hasil build lulus; akun/audit tetap satu pada schema tes |
| `PLAYWRIGHT_CHANNEL=msedge` lalu `npm.cmd run test:ui` | 4/4 lulus pada komputer/HP dan pemulihan koneksi gagal |
| Pemeriksaan schema utama setelah tes | 5 role, 0 pengguna, 0 proyek; fixture tidak masuk data bisnis |
| Hak akun database | `superuser=false`, `CREATEDB=false`, `CREATEROLE=false` |
| Cleanup pengujian | Tidak ada schema `simp_test_*` tersisa |

**Kendala yang diselesaikan:** sandbox Windows menolak token proses PostgreSQL, sehingga startup dijalankan dengan izin. Startup pertama juga menunggu pipe proses latar; helper diperbaiki agar pg_ctl tidak mewariskan pipe tersebut. Restart berikutnya berhasil. Kredensial layanan PostgreSQL existing tidak dibaca atau diganti.

**Batas hasil:** perubahan ini tetap pada fondasi T00. Belum ada login, CRUD pengguna/proyek, atau fitur progress. Helper lokal tidak mendaftarkan autostart Windows service. PostgreSQL tetap perlu dinyalakan sebelum aplikasi. Belum ada impor untuk SQLite yang berisi data bisnis karena workspace ini tidak memilikinya.

**Titik lanjut:** T01 menggunakan PostgreSQL dan pola transaksi asinkron baru. Tambahkan migration sesi pada direktori `postgresql/`; jangan memakai kembali API SQLite atau mengubah migration yang sudah diterapkan.

### 29 September 2026 — T01 login, role, dan pengguna

**Hasil:** seluruh kriteria T01 terpenuhi. Administrator dapat mengelola akun melalui UI; empat role lain memiliki ruang kerja sesuai identitas dan gagal mengakses pengelolaan akun melalui halaman maupun API langsung. Data berasal dari PostgreSQL.

**Perubahan utama:**

- `server/db/migrations/postgresql/002_sessions.sql`: sesi persisten dengan hash token, kedaluwarsa, relasi pengguna dan indeks.
- `server/services/auth.ts`, `server/routes/identity.ts`, `server/security/authorization.ts`: login/logout/me, sesi tervalidasi backend, Origin wajib, cookie HttpOnly/SameSite, limiter login, dan guard yang dapat dipakai modul berikutnya.
- `server/services/users.ts`: daftar/buat/ubah akun, role/status/password, email unik, audit, transaksi dan perlindungan Administrator aktif terakhir.
- `shared/validation.ts`, `shared/contracts.ts`, `server/errors.ts`: validasi bersama, tipe data aman dan error Indonesia per isian.
- `client/src/pages/`, `client/src/components/ui.tsx`, `client/src/api.ts`, `client/src/App.tsx`: login, navigasi role, daftar/form pengguna, pencarian, konfirmasi perubahan sensitif, loading/kosong/gagal/berhasil, pemulihan koneksi dan logout. Layout pengguna pada HP menampilkan tombol tanpa geser horizontal.
- `tests/identity.test.ts`, `tests/browser/identity.spec.ts`, `scripts/browser-test.ts`, `scripts/smoke.mjs`: pengujian keamanan/perilaku dengan schema PostgreSQL sementara dan fixture melalui service aplikasi.
- `.env.example`, README, arsitektur, keputusan dan rencana diperbarui. `.env` pribadi tidak ditimpa.

**Migration:** runner mengenali dua migration PostgreSQL. Verifikasi pada database utama melalui `node --env-file-if-exists=.env dist/server/cli/migrate.js` berhasil dengan **0 migration baru** karena migration sesi sudah diterapkan sebelumnya; query mengonfirmasi kedua migration tersedia. Untuk setup biasa, gunakan `npm.cmd run db:migrate` atau startup aplikasi. Tidak ada reset schema/data.

**Kebijakan sesi dan akses:** sesi absolut 8 jam, token acak hanya di cookie dan hash di DB. Logout mencabut sesi terkait; perubahan role/status/password mencabut seluruh sesi target dalam transaksi yang sama. Mengaktifkan akun kembali tidak memulihkan sesi lama. Nama/email saja tidak memutus sesi. Setiap request memeriksa role/status terkini. Origin mutasi harus cocok `APP_ORIGINS`; login dibatasi 20/menit/IP. Minimal satu Administrator aktif dipertahankan termasuk saat perubahan serentak. Rincian keputusan D12–D16 ada di [decisions](decisions.md).

| Pemeriksaan/perintah | Hasil aktual |
| --- | --- |
| `npm.cmd run build` | Lulus setelah perbaikan akhir UI; typecheck frontend/backend/tes dan build lengkap |
| `npm.cmd test` | **19/19 lulus**: 14 regresi T00 dan 5 skenario integrasi T01 |
| Tes konfigurasi terarah melalui hasil build | Lulus; APP_ORIGINS wildcard/path ditolak, COOKIE_SECURE tervalidasi |
| Login dan sesi | Benar/salah/nonaktif, token palsu/kedaluwarsa, cookie flags, rotasi, hash token, identitas aman, no-store dan logout lulus |
| Hak akses API langsung | Tanpa sesi ditolak; Owner/TL/Engineer/Inspector ditolak pada GET/POST/PATCH pengguna; payload tambahan/role palsu tidak memberi hak |
| Perubahan akun | Hash, validasi, email duplikat, audit tanpa rahasia, pencabutan semua sesi, aktivasi ulang, ganti password dan perlindungan Admin terakhir serentak lulus |
| Origin dan limiter | Origin kosong/asing ditolak; percobaan login ke-21 dalam satu menit mendapat 429 Indonesia |
| `npm.cmd run test:smoke` | Lulus: CLI migration/bootstrap, server development, dua startup hasil build, akun/audit tetap satu, cookie sesi yang sama valid lintas restart, route UI dan file privat |
| `$env:PLAYWRIGHT_CHANNEL = 'msedge'` lalu `npm.cmd run test:ui` | **16/16 lulus**, desktop 1280×900 dan HP 390×844; login/logout, form pengguna, persistensi setelah reload, nonaktif, empat role, penolakan akses dan pemulihan koneksi |
| Pemeriksaan visual | Screenshot login/daftar pengguna desktop/HP diperiksa; alur Admin tanpa page error, halaman tanpa overflow horizontal |
| Database utama setelah pengujian | 2 migration, 0 pengguna, 0 proyek; tidak ada schema `simp_test_*` tersisa |
| Dependensi baru | Cookie 11.1.2 dan rate-limit 11.2.0 dipin; instalasi melaporkan 0 vulnerabilities |
| Lint | Belum dikonfigurasi/dijalankan |

**Temuan yang diperbaiki:** tes browser awal menemukan tombol Ubah pada tabel HP sulit diklik; daftar HP diubah menjadi susunan per pengguna dengan semua tindakan terlihat. Pesan validasi yang menghilang saat blur juga dapat menggeser tombol sebelum klik selesai; error kini dibersihkan saat isian diedit. Selector notifikasi tes diperjelas agar tidak ambigu ketika indikator loading hadir bersamaan. Pengulangan lengkap terakhir lulus. Loader tsx/Edge kembali terhalang sandbox Windows (`uv_os_get_passwd`); tes backend/browser/smoke dijalankan di luar sandbox dengan izin, lalu lulus.

Bukti gambar: `test-results/identity-Administrator-mas-7aa05--dan-menonaktifkan-pengguna-desktop/` dan padanan `-phone/`, masing-masing `masuk.png` serta `pengguna.png`. Hasil tes diabaikan Git dan akun tes tidak berlaku di database bisnis.

**Cara mencoba:** isi nama/email/password bootstrap pada `.env`, jalankan `npm.cmd run db:bootstrap`, lalu `npm.cmd run dev` dan buka `http://127.0.0.1:5173/masuk`. Tidak ada akun/kata sandi bawaan; konfigurasi bootstrap belum diisi pada workspace ini. Setelah akun dibuat, hapus nilai bootstrap dari `.env`.

**Batas prototype:** belum ada CRUD proyek/penugasan atau direktori Owner/TL terbatas proyek (T02), workflow teknis, progress maupun ekspor. Ringkasan saat ini menampilkan identitas dan kondisi modul belum tersedia, tanpa data proyek palsu. Reset kata sandi dilakukan Administrator; registrasi publik/email reset/MFA tidak dibuat. Limiter bersifat satu proses; pengujian beban dan deployment production belum dilakukan. HTTPS kelak memerlukan COOKIE_SECURE=true dan origin yang sesuai.

**Titik lanjut:** kerjakan **T02 — Proyek dan tim** sesuai rencana. Gunakan guard sesi/role T01, tambahkan pemeriksaan penugasan di backend pada setiap akses proyek, dan pertahankan seluruh bukti regresi T00/T01.

### 29 September 2026 — T02 proyek dan tim

**Hasil:** seluruh kriteria T02 terpenuhi. Administrator/TL dapat membuat dan mengubah proyek, mengelola tim sesuai kewenangan, mengoreksi status dengan alasan, dan mengarsipkan proyek. Non-Admin hanya membaca proyek sesuai penugasan aktif; Owner/Engineer/Inspector tidak dapat mengubah informasi proyek. Semua data berasal dari PostgreSQL.

**Perubahan utama:**

- `server/db/migrations/postgresql/003_project_management.sql`: metadata arsip proyek, jejak pembaruan anggota, constraint alasan arsip, dan indeks. Migration lama tidak diubah.
- `shared/projects.ts`: schema semua informasi PRD §8, tanggal kalender valid, rentang tanggal, nominal nonnegatif, DTO proyek/tim, konversi BigInt sen, dan status berdasarkan tanggal.
- `server/services/projects.ts`: CRUD dengan arsip, pencarian/status, guard proyek, penugasan/periodenya, kandidat tim, pergantian TL, audit, serta perlindungan konflik periode dalam transaksi.
- `server/routes/projects.ts`: API proyek/tim di bawah plugin sesi, mewarisi validasi Origin/no-store. Timezone pembuatan proyek mengikuti konfigurasi backend.
- `client/src/pages/ProjectForm.tsx`, `Projects.tsx`, `ProjectTeam.tsx`, `client/src/projects.css`: form tiga langkah, daftar/detail proyek, pencarian/status/arsip, direktori tim, penugasan, koreksi status beralasan, dan konfirmasi arsip. Navigasi Proyek tersedia untuk kelima role.
- `tests/projects.test.ts`, `tests/browser/projects.spec.ts`, `tests/support/project-fixture.ts`: pengujian domain, API, persistensi dan browser lintas role. Fixture dibuat melalui service aplikasi pada schema sementara.
- `scripts/browser-test.ts`, `scripts/smoke.mjs`: fixture proyek/tim terisolasi dan pemeriksaan persistensi proyek lintas proses.
- README, arsitektur, keputusan D17–D23 dan rencana tahap diperbarui. Tidak ada dependensi tambahan atau perubahan rahasia `.env`.

**Kebijakan yang diterapkan:**

- Akses non-Admin mensyaratkan akun aktif, role akun sesuai penugasan, penugasan aktif, dan tanggal saat ini berada pada periode inklusif dalam timezone proyek. Akun di proyek A tidak otomatis mendapat akses proyek B. Perubahan penugasan langsung berlaku pada request berikutnya.
- Pembuat TL ditugaskan mulai hari pembuatan agar proyek mendatang dapat dipersiapkan. Administrator menentukan Owner/TL dan dapat mengubah periode/status penugasan TL. TL mengelola Engineer/Inspector proyeknya. Pergantian TL menonaktifkan penugasan TL sebelumnya.
- Status otomatis: sebelum mulai = Belum Dimulai; rentang tanggal inklusif = Berjalan; lewat tanggal selesai = Terlambat. UI menjelaskan bahwa progress belum tersedia. Selesai/Ditutup dan koreksi lain menggunakan alasan manual; kembali otomatis juga diaudit.
- DELETE proyek adalah arsip dengan konfirmasi/alasan: tidak menghapus relasi, menyembunyikan dari daftar default, dan menolak perubahan berikutnya. Penugasan dinonaktifkan untuk mencabut akses, bukan dihapus permanen.
- Nilai kontrak awal/berjalan disimpan terpisah sebagai BIGINT sen; API memakai string rupiah, tanpa pembulatan pecahan biner. Durasi dihitung database secara inklusif. Perubahan metadata menyimpan audit.

**Migration dan data utama:** verifikasi `node --env-file-if-exists=.env dist/server/cli/migrate.js` lulus dengan **0 migration baru** karena migration T02 sudah diterapkan saat verifikasi; database memiliki **3 migration**. Untuk setup biasa gunakan `npm.cmd run db:migrate` atau startup aplikasi. Pemeriksaan akhir: **0 pengguna, 0 proyek, 0 schema tes tersisa**; tidak ada fixture yang dimasukkan ke schema bisnis. Bootstrap Administrator lokal masih belum lengkap; rahasia tidak dicetak atau ditimpa.

| Pemeriksaan/perintah | Hasil aktual |
| --- | --- |
| `npm.cmd run build` | Lulus setelah perubahan akhir; typecheck frontend/backend/tes serta build UI/API/migration berhasil |
| `npm.cmd test` | **26/26 lulus**: 19 regresi T00/T01 dan 7 skenario T02 |
| `node --env-file-if-exists=.env --test dist/tests/projects.test.js` | **7/7 lulus** setelah melengkapi pengaturan periode TL; menguji hasil build akhir |
| Validasi proyek | Nama/kode wajib, tanggal palsu/kabisat/terbalik, nilai negatif/presisi lebih dari dua desimal/batas maksimum ditangani; durasi contoh 16–23 Juli = 8 hari |
| CRUD/persistensi | API buat/ubah/detail/pencarian, kode duplikat, seluruh metadata, uang 0,01 sampai batas sen aman, dan pembukaan koneksi baru lulus |
| Hak proyek | Tanpa login ditolak; A/B terisolasi pada detail/tim/kandidat/ubah/arsip; Owner/Engineer/Inspector ditolak pada mutasi walau memanggil API langsung |
| Penugasan | TL pembuat dapat menyiapkan proyek mendatang; pergantian TL mencabut akses lama; tanggal awal/akhir inklusif, masa depan/kedaluwarsa/nonaktif, role akun berubah, beberapa proyek, serta periode TL oleh Admin lulus |
| Konflik/histori | Role penugasan tidak boleh memalsukan role akun; member ID lintas proyek ditolak; periode overlap dan duplikasi serentak ditolak; audit/tim tetap ada setelah arsip |
| Status | Batas tanggal otomatis, koreksi Selesai beralasan, kembali otomatis, dan saringan status lulus |
| `npm.cmd run test:smoke` | Lulus: CLI, server development, dua startup build, cookie sesi tetap valid, proyek/nilai kontrak/durasi tetap sama lintas restart, routing serta file privat tetap terlindungi |
| `$env:PLAYWRIGHT_CHANNEL = 'msedge'` lalu `npm.cmd run test:ui` | **22/22 lulus** pada desktop 1280×900 dan HP 390×844; 16 regresi T01 ditambah 6 skenario T02 |
| Alur browser T02 | TL membuat/mengubah proyek, validasi form, penugasan Inspector, pencabutan akses tanpa logout, status, arsip/pencarian; Owner hanya-baca; Admin memilih TL/Owner dan mengubah periode TL |
| Pemeriksaan visual | Gambar daftar/detail proyek serta tim Admin pada desktop/HP diperiksa; tidak ada overflow horizontal pada skenario yang diuji atau page error pada alur TL |
| Lint | Belum dikonfigurasi/dijalankan |

**Temuan selama pengerjaan:** typing payload helper tes terlalu luas (`unknown`) menyebabkan typecheck gagal walaupun tes runtime lulus; diperbaiki sebelum build akhir. Pengaturan periode TL dilengkapi untuk Administrator dan diuji ulang pada backend/browser. Tes awal browser 20/20 lulus; sesudah menambah skenario Administrator, pengulangan lengkap 22/22 lulus. Tes tsx/Edge dijalankan di luar sandbox Windows sesuai kendala lingkungan yang sudah tercatat pada T01; tes hasil build berjalan tanpa loader tsx.

**Bukti gambar:** direktori `test-results/projects-TL-membuat-proyek-706d5--Inspector-dan-mengarsipkan-desktop/` dan padanan `-phone/` berisi `detail-proyek.png` serta `daftar-proyek.png`. Direktori `projects-Administrator-men-89588-ner-dan-mengatur-periode-TL-*` berisi `admin-tim.png`; skenario Owner memiliki `owner-proyek.png`. Hasil tes diabaikan Git.

**Cara mencoba:** selesaikan bootstrap Administrator lokal bila belum ada akun, jalankan `npm.cmd run dev`, masuk lalu buka **Proyek → Tambah Proyek**. Buat akun TL/Owner/Engineer/Inspector melalui Pengguna, isi proyek melalui tiga langkah, kemudian atur tim pada detail proyek. Petunjuk lengkap ada di [README — Mencoba T02](../README.md#mencoba-t02).

**Batas prototype:** status belum menggunakan progress aktual; belum ada pekerjaan/bobot, baseline, laporan teknis atau ekspor. Daftar belum memakai pagination. Arsip tidak memiliki tombol pemulihan pada T02. Riwayat disimpan di audit database; UI riwayat menyeluruh dikerjakan T09. Tidak ada klaim siap production.

**Titik lanjut terbaru:** kerjakan **T03 — Daftar pekerjaan dan bobot**. Tambahkan pekerjaan bertingkat, nilai/bobot daun, validasi siklus dan relasi lintas proyek, serta pengujian angka pembanding; gunakan guard proyek T02 dan pertahankan regresi T00–T02.

### 29 September 2026 — T03 pekerjaan bertingkat dan bobot

**Hasil:** seluruh kriteria T03 terpenuhi. Admin/TL dapat mengelola kelompok dan item pekerjaan melalui detail proyek. Nilai dan bobot berasal dari kalkulator backend; kelompok menjumlah turunannya tanpa dihitung lagi dalam total proyek. Owner/Engineer/Inspector yang ditugaskan hanya membaca. T04 belum dimulai.

**Perubahan utama:**

- `server/db/migrations/postgresql/004_work_items.sql`: pekerjaan, parent tunggal, FK komposit per proyek, kode unik, presisi desimal, constraint jenis/tanggal/nilai, audit identitas dan metadata penguncian basis proyek.
- `shared/work-items.ts`, `server/services/work-calculation.ts`: validasi bersama, konversi BigInt, perhitungan nilai/bobot dari item, agregasi kelompok, peringatan total nol/pembulatan serta format Indonesia.
- `server/services/work-items.ts`, `server/routes/work-items.ts`: daftar/buat/ubah/hapus, guard proyek/role, perlindungan siklus/referensi, transaksi dan audit. Hook internal `freezeWorkBasis` siap dipanggil dalam transaksi baseline T04; belum ada tombol atau endpoint penerbitan baseline.
- `server/services/projects.ts`: perubahan tanggal proyek tidak boleh mengeluarkan pekerjaan dari jadwal; perubahan tanggal biasa ditolak setelah basis terkunci.
- `client/src/pages/WorkItems.tsx`, `client/src/work-items.css`, `client/src/pages/Projects.tsx`: daftar hierarkis dan form dua langkah, pemilihan induk, nilai/bobot otomatis, konfirmasi hapus, validasi isian, kondisi kosong/memuat/gagal/berhasil dan tampilan HP.
- `tests/work-calculation.test.ts`, `tests/work-items.test.ts`, `tests/browser/work-items.spec.ts`: angka pembanding, integritas struktur, akses, konflik serentak, penguncian, persistensi dan alur browser. Runner browser/smoke dilengkapi data pekerjaan dalam schema tes terisolasi.
- README, arsitektur, keputusan D24–D30, rencana implementasi dan catatan progres diperbarui. Tidak ada dependensi tambahan atau perubahan rahasia `.env`.

**Keputusan perhitungan:** GROUP hanya wadah; ITEM tidak memiliki anak. Volume maksimal enam desimal, harga dua desimal, produk/total tepat delapan desimal dengan BigInt. Rasio bobot memakai nilai tepat; representasi API enam desimal dan tampilan dua desimal dibulatkan langsung dari rasio asli. Modul berikutnya wajib menggunakan rasio sumber, bukan bobot yang sudah dibulatkan. Total nilai nol menghasilkan bobot belum tersedia; selisih jumlah bobot tampilan lebih dari 0,01 poin menghasilkan peringatan. Status nonaktif tidak mengeluarkan item dari basis kontrak.

**Penguncian dan histori:** hook penguncian memerlukan TL proyek dan total nilai positif, idempoten, serta ikut rollback transaksi pemanggil. Setelah terkunci, tambah/hapus dan perubahan basis ditolak; metadata tetap dapat diedit dengan audit. Sebelum terkunci, hapus hanya diizinkan tanpa turunan/referensi. Tabel referensi sintetis dalam tes membuktikan FK RESTRICT bekerja untuk modul mendatang; bukan tabel runtime tambahan. Jadwal pekerjaan opsional, kedua tanggal harus diisi bersama dalam rentang proyek.

**Migration dan data utama:** `node --env-file-if-exists=.env dist/server/cli/migrate.js` lulus dengan **0 migration baru**; query mengonfirmasi **4 migration** sudah tersedia. Setup biasa memakai `npm.cmd run db:migrate` atau startup aplikasi. Pemeriksaan utama menunjukkan **0 pengguna, 0 proyek, 0 pekerjaan dan 0 schema tes tersisa**. Tidak ada reset atau fixture bisnis pada schema utama. Bootstrap Administrator lokal masih belum lengkap.

| Pemeriksaan/perintah | Hasil aktual |
| --- | --- |
| `npm.cmd run build` | Lulus termasuk pengulangan setelah perbaikan CSS HP; typecheck frontend/backend/tes dan build UI/API/migration berhasil |
| `npm.cmd test` | **37/37 lulus**: 26 regresi T00–T02, 7 tes kalkulasi/validasi dan 4 skenario integrasi T03 |
| Angka pembanding | Contoh PRD 1.130 × 82.504,02 = 93.229.542,60; agregat bertingkat, bobot 10/20/70%, nilai nol, nilai sangat kecil dan batas maksimum lulus |
| Pembulatan | Tiga item sama menghasilkan jumlah tampilan 99,99% dalam toleransi; enam item sama menghasilkan 100,02% dengan peringatan; rasio sumber tetap utuh |
| Struktur dan akses | Siklus/parent ganda/induk ITEM/lintas proyek ditolak; akses semua role, manipulasi ID, mutasi tanpa hak, konflik kode dan dua perubahan induk serentak lulus |
| Referensi dan basis | Penghapusan induk/item dirujuk ditolak; proyek arsip hanya-baca; penguncian, idempotensi, rollback, edit metadata dan guard tanggal proyek lulus |
| `npm.cmd run test:smoke` | Lulus: migration/bootstrap CLI, server development, dua startup hasil build, persistensi akun/sesi/proyek/pekerjaan/bobot, route UI dan perlindungan file privat |
| `$env:PLAYWRIGHT_CHANNEL = 'msedge'` lalu `npm.cmd run test:ui` | **26/26 lulus**, desktop 1280×900 dan HP 390×844; 22 regresi dan 4 skenario T03 |
| `npm.cmd run test:ui -- tests/browser/work-items.spec.ts` dengan Edge | **4/4 lulus** setelah perbaikan CSS terakhir; tambah kelompok bertingkat/item, edit/hitung ulang, reload, validasi, hapus, Owner hanya-baca dan retry setelah 503 |
| Pemeriksaan visual | Screenshot form dan daftar desktop/HP diperiksa; ringkasan HP diperbaiki menjadi satu kolom agar angka terbaca; tanpa overflow horizontal atau page error pada alur yang diuji |
| Lint | Belum dikonfigurasi/dijalankan |

**Temuan selama validasi:** style ringkasan umum mengalahkan aturan mobile pekerjaan sehingga angka terbungkus pada kolom sempit. Selector CSS diperjelas, build dan keempat tes browser T03 diulang, lalu gambar HP diperiksa kembali. Tes tsx/Edge/smoke dijalankan di luar sandbox Windows karena kendala loader lingkungan yang telah dicatat sebelumnya; pemeriksaan CLI hasil build berjalan biasa.

**Bukti gambar:** `test-results/work-items-pekerjaan-berti-61f54-indungi-kelompok-berturunan-desktop/` dan padanan `-phone/`, masing-masing `form-pekerjaan.png` serta `pekerjaan-bobot.png`. Skenario Owner menyimpan `owner-pekerjaan.png`. Hasil tes diabaikan Git dan dapat terganti saat tes berikutnya dijalankan.

**Workbook:** pemeriksaan terbatas lembar M1 menemukan `K20 = H20*J20` dan `L20 = K20/$K$67*100`, sesuai formula nilai dan bobot PRD. Referensi eksternal `[1]Data!…`, perhitungan ulang seluruh workbook dan kesetaraan layout belum divalidasi. Workbook tidak diubah dan tidak menjadi sumber data runtime.

**Cara mencoba:** masuk sebagai Admin/TL yang berhak, buka **Proyek → detail proyek → Daftar Pekerjaan**. Tambahkan kelompok, kemudian pekerjaan dengan volume/harga; lihat total dan bobot dihitung setelah penyimpanan. Petunjuk bootstrap dan menjalankan aplikasi ada di [README](../README.md#mencoba-t03).

**Batas prototype:** belum ada penerbitan baseline, editor target, revisi rencana, laporan harian, progress aktual atau ekspor. Daftar belum memakai pagination; kedalaman indentasi visual dibatasi agar nyaman di HP, sedangkan tingkat sebenarnya tetap ditampilkan. Riwayat tersedia di audit DB, UI riwayat menyeluruh tetap T09. Tidak ada klaim siap production.

**Titik lanjut terbaru:** kerjakan **T04 — Periode dan rencana terversi**. Periksa formula periode workbook, bangun service periode/editor target, snapshot Rencana Awal dan revisi bertanggal berlaku. Panggil `freezeWorkBasis` dalam transaksi penerbitan baseline yang sama; gunakan nilai tepat T03 dan pertahankan seluruh regresi T00–T03.

### 29 September 2026 — T04 periode dan rencana terversi

**Hasil:** seluruh kriteria T04 terpenuhi. TL proyek dapat menerbitkan Rencana Awal dan perubahan rencana melalui form tiga langkah. Versi terbit, target, basis serta jadwal sebelumnya dipertahankan. Tanggal pemeriksaan memilih versi berlaku secara otomatis; pilihan versi eksplisit dan perbandingan tetap tersedia. Admin/Owner/Engineer/Inspector hanya membaca sesuai akses proyek.

**Perubahan utama:**

- `server/db/migrations/postgresql/005_project_plans.sql`: versi, identitas baseline, predecessor, nomor/tanggal berlaku unik, snapshot basis/jadwal, item target dengan FK komposit, serta trigger yang menolak UPDATE/DELETE versi dan item terbit.
- `shared/plans.ts`: periode minggu/bulan proyek, posisi hari/minggu/bulan, sisa hari, batas operasional, validasi dan kontrak API.
- `server/services/plan-calculation.ts`: alokasi harian dan agregasi target fisik/volume/tertimbang/kumulatif menggunakan pecahan BigInt tepat; tampilan mingguan dan bulanan memakai satu sumber.
- `server/services/plans.ts`, `server/routes/plans.ts`: histori, pemilihan effective_date, publikasi khusus TL, kontrol editor basi, transaksi freeze/versi/target/audit dan angka per versi/proyek.
- `client/src/pages/Plans.tsx`, `client/src/plans.css`, integrasi `Projects.tsx`: editor identitas → target → pemeriksaan, pembagian rata, cutoff, rincian angka tiap item, perbandingan versi, daftar pekerjaan berubah, metadata publikasi, loading/kosong/gagal/berhasil serta retry.
- `tests/plans-calculation.test.ts`, `tests/plans.test.ts`, `tests/browser/plans.spec.ts`: angka pembanding, kalender, workflow versi, keamanan, transaksi, konkurensi dan UI desktop/HP. Runner browser serta smoke memakai baseline nyata melalui service/API aplikasi dalam schema tes.
- README, arsitektur, keputusan D31–D38 dan rencana tahap diperbarui. Tidak ada dependensi tambahan atau perubahan rahasia `.env`.

**Aturan periode dan angka:** minggu tujuh hari sejak tanggal mulai; bulan ditambah dari tanggal mulai asli dan di-clamp ke akhir bulan. Periode terakhir parsial. Tiap ITEM harus memiliki target incremental tepat 100%, maksimal enam desimal; GROUP tidak mendapat target sendiri. Satu granularitas sumber per versi; target dibagi merata per hari untuk agregasi silang. Pecahan dan bobot dihitung tepat sebelum representasi enam desimal, sehingga pembulatan tampilan tidak masuk perhitungan berikutnya. Tes angka manual mencakup bobot 25/75% dan alokasi 3/7 minggu terakhir: total bulan pertama 54,285714%, akhir kumulatif 100%.

**Versi dan jadwal:** baseline berlaku sejak start proyek, snapshot basis tetap. Revisi memerlukan alasan dan tanggal berlaku setelah versi terakhir serta tidak sebelum hari ini proyek. Tanggal mulai tetap, tanggal selesai/target dapat berubah. Tanggal kontrak pada informasi proyek dipertahankan; jadwal pelaksanaan efektif ada pada versi rencana sesuai cutoff. Versi masa depan tidak mengubah versi/jadwal yang sedang berlaku. Publikasi serentak atau retry dengan predecessor lama ditolak tanpa nomor ganda. Riwayat tidak dihapus; draf form belum diterbitkan belum disimpan.

**Migration dan data utama:** `node --env-file-if-exists=.env dist/server/cli/migrate.js` lulus dengan **0 migration baru** karena startup sudah menerapkan migration baru. Query akhir mengonfirmasi **5 migration, 0 pengguna, 0 proyek, 0 pekerjaan, 0 rencana dan 0 schema tes tersisa**. Setup biasa memakai `npm.cmd run db:migrate` atau startup aplikasi. Tidak ada reset atau penambahan fixture pada schema bisnis. Bootstrap Administrator lokal masih belum lengkap; nilainya tidak dicetak/ditimpa.

| Pemeriksaan/perintah | Hasil aktual |
| --- | --- |
| `npm.cmd run build` | Lulus, termasuk pengulangan akhir setelah melengkapi pesan validasi Indonesia; typecheck frontend/backend/tes dan build UI/API/migration berhasil |
| `npm.cmd test` | **46/46 lulus**: 37 regresi T00–T03, 4 tes periode/kalkulasi, 5 skenario integrasi T04 |
| Periode | Mulai 16 Juli, hari terakhir parsial, satu hari, lintas tahun, 29 Februari, clamp 31 Januari dari tanggal asli, sebelum/sesudah rentang, sisa hari dan tanggal tidak sah lulus |
| Kalkulasi | Sumber mingguan→bulanan dan bulanan→mingguan, rasio bobot tepat, target volume, nilai/volume nol, pembulatan serta kumulatif akhir 100% lulus |
| Publikasi/histori | Baseline membekukan basis; revisi mempertahankan baseline/angka lama; versi masa depan baru berlaku pada batas tanggal; snapshot tetap sama setelah koneksi dibuka ulang |
| Validasi/rollback | Target tidak 100/negatif/presisi berlebih/jumlah periode salah, ID ganda/lintas proyek, basis stale, alasan/tanggal revisi invalid ditolak; kegagalan insert target membatalkan freeze, versi dan audit |
| Akses/konkurensi | Tanpa login ditolak; Admin/Owner/Engineer/Inspector tidak dapat publish; TL proyek lain, ID versi asing, arsip, overwrite API/SQL dan dua publikasi serentak terlindungi |
| Isolasi aktual | Tabel sumber aktual **khusus fixture** dan basis tetap identik setelah revisi; belum merupakan pengujian workflow persetujuan nyata, wajib diulang pada T07 |
| `npm.cmd run test:smoke` | Lulus: migration/bootstrap, sesi Admin/TL, server development, dua startup hasil build, baseline/target/bobot/pekerjaan/proyek tetap sama, route UI dan file privat terlindungi |
| `$env:PLAYWRIGHT_CHANNEL = 'msedge'` lalu `npm.cmd run test:ui` | **30/30 lulus** pada desktop 1280×900 dan HP 390×844; 26 regresi ditambah 4 skenario T04 |
| Alur browser T04 | Target tidak lengkap ditolak, baseline terbit/reload, revisi bulanan memperpanjang jadwal, future tidak aktif dini, cutoff memilih versi baru, perbandingan/rincian periode, penguncian pekerjaan, Owner hanya-baca dan pemulihan 503 |
| Pemeriksaan visual | Editor target dan perbandingan desktop/HP diperiksa; tidak ada overflow horizontal atau page error pada alur TL |
| Lint | Belum dikonfigurasi/dijalankan |

**Temuan selama pengerjaan:** perpindahan kembali ke langkah identitas dapat mereset target revisi walau jadwal tidak berubah; editor kini menyimpan identitas jadwal target dan hanya mereset saat jadwal/sumber periode berubah. Pesan batas validasi dilengkapi Bahasa Indonesia sebelum build akhir. Tidak ada kegagalan pada rangkaian tes backend/browser yang dijalankan. Loader tsx/Edge memerlukan eksekusi di luar sandbox Windows seperti tahap sebelumnya; CLI hasil build berjalan biasa.

**Workbook:** M1 L12/N12 memakai VLOOKUP ke `[1]Data!$N$23:$R$43`; R12 memakai `(Q12*7)-3`, dengan cache minggu pertama empat hari. B1 mengacu akhir M5. Implementasi mempertahankan aturan PRD/domain (minggu tujuh hari sejak start dan bulan kalender dari start). Kesetaraan tabel tanggal eksternal, perhitungan ulang workbook serta layout belum diklaim; workbook tidak diubah.

**Bukti gambar:** `test-results/plans-TL-menerbitkan-basel-c51c9-off-dan-membandingkan-versi-desktop/` dan padanan `-phone/` berisi `editor-target.png` serta `perbandingan-rencana.png`. Skenario Owner menyimpan `owner-rencana.png`. Hasil tes diabaikan Git dan dapat terganti pada pengujian berikutnya.

**Cara mencoba:** selesaikan bootstrap bila belum ada akun, buat/masuk sebagai TL yang ditugaskan, lengkapi pekerjaan lalu buka **Proyek → detail proyek → Rencana Proyek**. Ikuti [README — Mencoba T04](../README.md#mencoba-t04).

**Batas prototype:** belum ada laporan harian, foto, persetujuan, progress aktual atau ekspor. Form belum memiliki autosave/draf persisten. Maksimal 3.660 hari, 500 item dan 20.000 isian target per versi; histori belum dipaginasi. Tidak ada pembatalan versi terbit atau pergeseran tanggal mulai setelah baseline. Status proyek T02 masih mengikuti tanggal kontrak; penyelarasan ringkasan/status tetap T09. Tidak ada klaim siap production.

**Titik lanjut terbaru:** kerjakan **T05 — Laporan harian dan dokumentasi lapangan**. Gunakan akses proyek, basis terkunci dan jadwal versi efektif sesuai tanggal kegiatan; bangun laporan beserta child data/foto privat dan validasi. Jangan menghitung progress resmi sebelum workflow persetujuan T06/T07; pertahankan regresi T00–T04 dan ulangi uji invariansi aktual dengan laporan sah pada T07.

### 29 September 2026 — T05 laporan harian dan dokumentasi lapangan

**Hasil:** seluruh kriteria T05 terpenuhi dan tervalidasi. Form empat bagian, draf milik sendiri, detail laporan, foto privat, dokumentasi pekerjaan dan kirim untuk diperiksa tersedia. Tidak ada endpoint persetujuan atau progress resmi pada T05.

**Perubahan utama:**

- `server/db/migrations/postgresql/006_daily_reports.sql`: laporan unik per proyek/tanggal/pembuat, counter nomor, versi edit, referensi rencana, aktivitas, child tenaga kerja/cuaca/material/masalah, foto dan FK komposit. Migration lama tidak diubah.
- `shared/reports.ts`: kontrak/validasi, kategori tenaga kerja, status, data foto dan laporan. Naratif memakai volume null; kuantitatif wajib merujuk item basis dan satuan ditentukan backend.
- `server/services/reports.ts`, `server/routes/reports.ts`: simpan/detail/daftar/hapus draf, submit, upload/read/delete foto, dokumentasi per pekerjaan, audit, hak baca/milik serta kontrol konflik versi.
- `server/services/projects.ts`: guard menerima role penulis eksplisit untuk modul laporan (TL/Inspector); default modul proyek tetap Admin/TL. `app`, `index` dan plugin route meneruskan konfigurasi UPLOAD_DIR.
- `client/src/pages/Reports.tsx`, `client/src/reports.css`: form bertahap, rincian tersimpan, upload foto, ringkasan sebelum kirim, status terkunci serta dokumentasi pekerjaan. Detail proyek dan daftar pekerjaan mendapat tautan fitur terkait.
- `tests/reports.test.ts`, `tests/browser/reports.spec.ts`, runner browser/smoke: pengujian data lengkap, akses lintas role/proyek, file palsu/rusak, rollback, edit/kirim serentak, foto lintas restart serta UI. Direktori foto tes acak dibersihkan dan terpisah dari storage pengguna.
- Sharp **0.35.5** ditambahkan dan dipin pada package/lockfile untuk decode/re-encode foto. Instalasi melaporkan **0 vulnerabilities**; tidak ada perubahan rahasia `.env`. README, panduan cara pakai, arsitektur dan keputusan D39–D47 diperbarui.

**Aturan yang diterapkan:**

- TL/Inspector membuat dan mengubah draf sendiri. Inspector hanya membaca laporannya sendiri; Admin/TL/Engineer membaca sesuai proyek. Owner hanya membaca APPROVED, termasuk metadata/berkas foto/dokumentasi pekerjaan. Uji status APPROVED memakai fixture SQL terbatas; bukan klaim alur approval aplikasi sudah dibangun.
- Tanggal tidak melewati hari ini proyek, dan masuk jadwal versi efektif pada tanggal kegiatan. Snapshot referensi rencana/identitas proyek dipertahankan; hari/minggu/durasi/sisa hari berasal dari jadwal tersebut, termasuk perpanjangan sah.
- Minimal satu kegiatan wajib untuk simpan. Tenaga kerja terpisah per jenis, jumlah dan jam valid; identitas opsional. Cuaca malam boleh kosong; tiap waktu hanya sekali dan jam dalam tanggal sama. Material ditolak wajib alasan. Tanggal material/masalah/foto sama dengan laporan.
- Jumlah volume per pekerjaan dalam satu laporan tidak boleh melebihi kontrak; kegiatan naratif tidak menjadi sumber progress. Batas volume kumulatif seluruh laporan sah tetap tanggung jawab T06/T07.
- Foto JPEG/PNG maksimal 5 MiB, 20 juta piksel, 20 foto/laporan; isi/signature/decoder diverifikasi lalu disimpan ulang JPEG dengan nama UUID server. File hanya melalui API berhak, tanpa static URL, dengan no-store/nosniff. Setiap kegiatan bervolume positif wajib foto saat kirim; draf boleh belum berfoto.
- Perubahan draft/foto/kirim menaikkan editVersion dan diaudit. Konflik meminta muat ulang; kirim ganda tidak menghasilkan dua audit. Setelah SUBMITTED, edit/upload/hapus ditolak. Mengubah tanggal/pekerjaan kegiatan berfoto meminta hapus foto terkait dahulu.

**Migration:** `node --env-file-if-exists=.env dist/server/cli/migrate.js` lulus dengan **0 migration baru**, karena migration baru sudah diterapkan saat startup. Setup biasa memakai `npm.cmd run db:migrate` atau startup aplikasi. Query setelah seluruh tes selesai mengonfirmasi **6 migration, 0 pengguna, 0 proyek, 0 laporan, 0 foto dan 0 schema tes tersisa**. Tidak ada reset atau fixture dimasukkan ke schema bisnis. Bootstrap Administrator lokal belum lengkap; rahasia tidak dicetak/ditimpa.

| Pemeriksaan/perintah | Hasil aktual |
| --- | --- |
| `npm.cmd run build` | Lulus, termasuk pengulangan terakhir sesudah perbaikan CSS foto; typecheck frontend/backend/tes serta build UI/API/migration berhasil |
| `npm.cmd test` | Awal 49/51; setelah memperjelas alias kolom query daftar laporan, **51/51 lulus** (46 regresi dan 5 skenario integrasi T05) |
| Data dan tanggal | Semua child tersimpan/dibuka ulang/diubah tanpa kehilangan data, satuan server, hitungan hari, naratif tanpa foto, perpanjangan rencana efektif dan tanggal masa depan ditolak |
| Validasi dan akses | Kegiatan kosong, tenaga kerja negatif, cuaca terbalik/ganda, material ditolak tanpa alasan, volume berlebih, item asing, role/status palsu, Inspector lain serta foto Owner belum sah terlindungi |
| Konkurensi dan histori | Draf tanggal sama ditolak, edit serentak satu berhasil, foto wajib sebelum kirim, kirim serentak satu audit, submit mengunci semua mutasi, nomor tidak digunakan ulang setelah hapus |
| Foto | JPEG/PNG valid terbaca, signature/MIME palsu, data terpotong, ukuran/piksel berlebih ditolak; insert metadata gagal membersihkan file; hapus foto/draf membersihkan storage; foto tidak tersedia pada URL storage publik |
| Persistensi | Pembukaan pool PostgreSQL baru mempertahankan seluruh laporan/foto; `npm.cmd run test:smoke` lulus: server development, dua startup build, akun/sesi/proyek/basis/rencana/laporan SUBMITTED/foto JPEG tetap sama dan foto tanpa sesi 401 |
| Browser T05 terarah | `npm.cmd run test:ui -- tests/browser/reports.spec.ts` dengan Edge: **4/4 lulus**, desktop/HP |
| Browser regresi lengkap | `$env:PLAYWRIGHT_CHANNEL = 'msedge'` lalu `npm.cmd run test:ui`: pengulangan akhir **34/34 lulus**, 30 regresi T00–T04 dan 4 skenario T05. Percobaan sebelumnya 33/34; masalah ruang foto lazy HP diperbaiki dan tes memastikan decode setelah scroll |
| Pemeriksaan visual | Screenshot form/detail/foto desktop dan HP diperiksa; tombol membungkus dengan rapi, foto termuat, tanpa overflow horizontal pada form/detail yang diuji dan tanpa page error alur sukses |
| Lint | Belum dikonfigurasi/dijalankan |

**Temuan yang diperbaiki:** generic form awal memperlebar tipe pilihan menjadi string dan gagal typecheck; tipe baris dibuat eksplisit. Query daftar laporan memiliki `created_by` ambigu setelah JOIN users; alias diperjelas, seluruh backend diulang dan lulus. Screenshot form HP menunjukkan tombol terlalu rapat; tindakan form dibuat dapat membungkus. Regresi HP kemudian menemukan foto lazy belum memiliki ruang sebelum dimuat; CSS aspect-ratio menjaga ruangnya, dan tes menggulir ke foto serta memeriksa naturalWidth agar benar-benar membuktikan file termuat. Eksekusi tsx/Edge/Sharp mengikuti kebutuhan izin lingkungan Windows yang telah dicatat pada tahap sebelumnya.

**Bukti gambar:** direktori `test-results/reports-laporan-lengkap-te-9604d-aan-dan-pengiriman-terkunci-desktop/` dan padanan `-phone/` berisi `form-laporan.png` serta `laporan-terkirim.png`. Skenario Inspector/Owner menyimpan `owner-laporan.png`. Hasil tes diabaikan Git dan dapat terganti saat pengujian berikutnya.

**Cara mencoba:** masuk sebagai Inspector/TL, buka **Proyek → detail proyek → Laporan Harian**, isi laporan dan simpan sementara, unggah foto terkait kegiatan, lalu periksa dan kirim. Panduan lengkap tersedia pada [README — Mencoba T05](../README.md#mencoba-t05) dan [cara pakai](cara-pakai.md).

**Batas prototype:** belum ada approval/permintaan perbaikan/revisi laporan sah, progress resmi, galeri proyek menyeluruh atau ekspor. Draf tidak memiliki autosave; daftar/galeri belum dipaginasi. Maksimal 100 baris tiap child (cuaca empat), foto 20/laporan. Database dan filesystem bukan satu transaksi fisik: crash atau gagal unlink dapat meninggalkan file tanpa referensi, meskipun tidak dapat dilayani API; rekonsiliasi otomatis belum dibuat. Backup harus mencakup database dan UPLOAD_DIR. Bukan klaim siap production.

**Titik lanjut T06:** tambahkan pemeriksaan Engineer, keputusan TL beralasan, permintaan perbaikan serta koreksi laporan sah sebagai revisi baru. Pertahankan laporan/foto sumber lama, hak Owner, kontrol konkurensi dan audit; siapkan sumber kontribusi unik untuk T07 tanpa menghitung data yang belum disetujui.

### 30 September 2026 — Pemulihan startup migration T06

**Root cause:** saat pengembangan T06, migration `007_report_reviews.sql` sudah diterapkan pada database utama, lalu berkasnya ditambahi fungsi/trigger perlindungan header dan rincian laporan APPROVED. Startup memeriksa SHA-256 dan berhenti sebelum membuka port 3001. `ECONNREFUSED` frontend adalah akibat backend belum listening; bukan masalah `node_modules/@img/sharp-win32-x64/versions.json`.

- Checksum 007 yang tercatat: `4ae65c6756fcf69b075431ceb95156e9aa19129f2013fcfeac1098022f1cdc18`.
- Checksum berkas 007 yang berubah: `9b06fefc2e7d816af161d67919c5fcc1a50ccb4a631a107ac6e9f98515657411`.
- Isi awal sampai trigger `approved_source_guard`, memakai LF dan satu newline akhir, cocok persis dengan checksum tercatat. Database hanya memiliki trigger tersebut, belum memiliki trigger perlindungan tambahan.
- 007 dikembalikan ke isi asli yang terverifikasi. Tambahan dipindahkan utuh ke `008_approved_report_guards.sql`: fungsi `protect_approved_report`, `protect_approved_report_child`, trigger header dan enam trigger rincian. Pemeriksaan checksum tetap aktif; history tidak disunting manual.
- Build/typecheck lulus. CLI normal `node --env-file-if-exists=.env dist/server/cli/migrate.js` menerapkan **1 migration baru**; pengulangan runner menghasilkan **0**.
- Nama/checksum/applied_at history 001–007 identik sebelum/sesudah. Jumlah dan sidik isi **18 tabel** identik. Database utama pada saat pemeriksaan mempunyai nol pengguna/proyek/laporan/foto/pemeriksaan/sumber resmi; tidak ada reset/drop ataupun seed bisnis. Trigger lama dan tujuh trigger baru terpasang.
- Backend hasil build dijalankan pada `127.0.0.1:3001` sebagai proses Node tersembunyi (PID saat pemulihan: 1304). `/` **200**, `/api/health` **200**, `/api/auth/me` **401 UNAUTHENTICATED** tanpa cookie. 401 membuktikan backend merespons normal; tidak ada ECONNREFUSED.
- Tes terarah database/laporan setelah pemisahan migration: **17/17 lulus**. Validasi regresi T06 lengkap dicatat pada entri berikut setelah selesai.

Bukti lokal tanpa kredensial: `.tmp/t06-migration-recovery-before.json`, `.tmp/t06-migration-recovery-result.json`, serta log `.tmp/backend-recovery.stdout.log` dan `.tmp/backend-recovery.stderr.log`. PID bersifat sementara; sebelum menjalankan backend kedua pada port yang sama, hentikan proses backend pemulihan setelah memastikan identitas prosesnya.

### 30 September 2026 — T06 pemeriksaan, persetujuan dan koreksi selesai

**Hasil:** empat status laporan mengikuti state machine PRD. Engineer menambahkan catatan teknis pada laporan terkirim; TL proyek meminta perbaikan beralasan atau menyetujui. Pembuat dapat memperbaiki NEEDS_REVISION lalu mengirim ulang. SUBMITTED terkunci; APPROVED hanya dikoreksi melalui versi baru. Owner membaca laporan/foto disetujui dan tidak menerima metadata koreksi yang belum sah.

**Perubahan utama:**

- Migration **007** menambahkan identitas logis/versi, predecessor, alasan koreksi, pemeriksaan bersnapshot dan `approved_report_sources`; **008** menambahkan trigger immutable header/rincian. Pemulihan checksum dijelaskan pada entri sebelumnya; tidak menonaktifkan pemeriksaan migration.
- Service/API `reviews` memeriksa role dan penugasan aktif setiap transaksi. Catatan Engineer tidak mengubah status; keputusan TL, snapshot seluruh isian/foto, audit dan sumber resmi disimpan atomik. `editVersion` dan lock proyek menolak klik ganda/konflik dengan 409 tanpa efek ganda.
- Service/API `corrections` menyalin isian dan foto dari versi sah terbaru. Nomor/tanggal/pembuat tetap, nomor revisi bertambah, alasan wajib. Foto mendapat UUID/file sendiri; perubahan koreksi tidak merusak foto lama. Hanya satu koreksi belum selesai per laporan. Rollback membersihkan salinan file baru.
- Sumber lama tetap berlaku selama koreksi belum disetujui. Persetujuan koreksi mengganti satu pointer sumber, bukan menambah dua kontribusi. Batas volume kumulatif memakai BigInt enam desimal, diuji saat kirim dan approval dengan mengecualikan versi lama dari laporan logis yang sama.
- UI menyediakan filter Menunggu Pemeriksaan, catatan Engineer, keputusan/perbaikan TL, alasan koreksi, riwayat pemeriksa/waktu/catatan, tautan versi dan label sumber berlaku/arsip. Form dan foto dapat dipakai pada desktop serta HP.
- README, cara-pakai, architecture, decisions dan implementation-plan diperbarui. Keputusan D48–D57 mencatat batas prototype dan kontrak sumber untuk T07.

**Validasi aktual:**

| Pemeriksaan | Hasil |
| --- | --- |
| `npm.cmd test` | **57/57 lulus**: regresi T00–T05 dan enam skenario T06, termasuk upgrade bertahap 006→007→008 dengan checksum 007 terverifikasi dan history 001–007 tetap identik |
| `npm.cmd run build` | Typecheck frontend/backend/tes serta build lulus |
| `npm.cmd run test:smoke` | Lulus: CLI, development dan dua restart build; laporan APPROVED, catatan pemeriksa, pointer sumber resmi, sesi, data dan foto tetap tersimpan |
| Browser lengkap dengan Edge | **34 tes regresi lulus**; dua skenario T06 awal gagal pada ekspektasi `70 m` karena UI menampilkan `70,000000 m`. Sebelumnya fixture penugasan Owner dan selector status juga diperbaiki |
| `npm.cmd run test:ui -- tests/browser/reviews.spec.ts` | Pengulangan akhir **2/2 lulus**, desktop/HP; alur Engineer → perbaikan TL → kirim ulang → persetujuan → koreksi → persetujuan → Owner/arsip, tanpa manipulasi database manual |
| Pemeriksaan UI | Screenshot desktop/HP ditinjau; foto berhasil didekode setelah scroll, tidak ada pageerror atau overflow horizontal. Tautan versi diberi nowrap agar label tetap utuh di HP |
| Startup dan koneksi pengguna | Backend `3001/api/health` **200**; `3001/api/auth/me` dan proxy `5173/api/auth/me` **401** tanpa sesi, bukan ECONNREFUSED; halaman build `/` **200** |
| Database utama setelah validasi | **8 migration; 0 pengguna, proyek, laporan, foto; 0 schema tes tersisa**. Data bisnis tidak direset atau diberi fixture |

Tes memastikan Admin/Engineer/Inspector/Owner tidak dapat approval, TL proyek lain ditolak, akun/penugasan nonaktif dan arsip ditolak, alasan wajib, invalid transition/edit biasa ditolak, keputusan serentak satu efek, volume kumulatif tidak berlebih, sumber rollback utuh, foto lama tetap terbaca, dan Owner tidak melihat koreksi belum disetujui. TL boleh menyetujui laporannya sendiri sesuai PRD.

Bukti gambar terbaru: `test-results/reviews-T06-pemeriksaan-En-d9fe9-wner-melalui-desktop-dan-HP-desktop/koreksi-disetujui.png` dan padanan `-phone/koreksi-disetujui.png`. `.last-run.json` terakhir menyatakan passed tanpa failedTests. Hasil browser lengkap dan pengulangan terarah dicatat terpisah; tidak diklaim sebagai satu run 36/36.

**Batas prototype:** progress/rekap/kurva/ekspor belum dibangun. Koreksi dibuat pembuat yang masih aktif; pengalihan kepemilikan belum tersedia. Laporan yang pernah diperiksa serta semua koreksi tidak dapat dihapus. Foto disalin per versi sehingga storage bertambah; crash proses tetap dapat meninggalkan file tanpa referensi seperti T05. Tidak ada deployment production.

**Cara mencoba:** buka **Proyek → Laporan Harian**, kirim laporan sebagai Inspector/TL, catat temuan sebagai Engineer, lalu putuskan sebagai TL. Gunakan **Buat Koreksi** pada versi sah terakhir dan buka **Versi laporan** untuk membandingkan arsip. Rincian pada [cara-pakai bagian G–H](cara-pakai.md).

**Titik lanjut:** kerjakan **T07** dari join aktivitas ke `approved_report_sources`, bukan semua baris APPROVED. Gunakan basis tetap, tanggal kegiatan dan versi rencana efektif; uji ulang invariansi aktual terhadap perubahan rencana serta penggantian kontribusi saat koreksi.


### 30 September 2026 - Bentrok port saat restart .env

Backend hasil build dari pemulihan sebelumnya (PID 1304, node dist/server/index.js) masih memakai port 3001 ketika pengguna menjalankan development. Restart setelah perubahan .env gagal dengan EADDRINUSE; concurrently kemudian menghentikan frontend. Proses pemulihan diverifikasi melalui PID, command line dan waktu pembuatan, lalu dihentikan secara khusus. Uji bind memastikan port 3001 dan 5173 tersedia; PostgreSQL tetap aktif pada 55432. Tidak ada perubahan .env, migration atau data bisnis. Selanjutnya jalankan satu npm.cmd run dev dari terminal pengguna; backend pemulihan tidak dijalankan ulang di latar belakang.


### 30 September 2026 - Administrator pertama berhasil dibuat

Pemeriksaan tanpa menampilkan identitas atau kredensial menemukan isian bootstrap valid tetapi database belum memiliki akun. Menyimpan .env saja tidak menjalankan bootstrap. npm.cmd run db:bootstrap kemudian berhasil membuat Administrator dari isian yang disiapkan pengguna. Backend health dan frontend merespons 200; login melalui proxy frontend memakai isian tersebut berhasil 200, lalu sesi verifikasi ditutup melalui logout 204. Pada pemeriksaan akhir hanya satu listener backend 3001 dan satu frontend 5173. Tidak ada pembatasan alamat Gmail; aplikasi memakai autentikasi email/kata sandi lokal.

### Ringkasan kelulusan T07 — 30 September 2026

**Hasil:** satu alur progress resmi dari PostgreSQL ke UI `/proyek/:id/progress` tersedia. `server/services/progress.ts` memilih sumber sah dan menerapkan hak akses; `progress-calculation.ts` menghitung volume/fisik/tertimbang sebelumnya, periode berjalan dan kumulatif, total daun, target dan deviasi. `fractions.ts` serta `planTargetsBetween` dipakai bersama perhitungan rencana. Frontend hanya memformat hasil server.

**Perilaku penting:** basis tetap snapshot Rencana Awal; versi pembanding mengubah target saja. Cut-off inklusif menurut tanggal kegiatan. Koreksi pending mempertahankan angka lama, kemudian mengganti kontribusi saat disetujui. Sumber dapat ditelusuri ke laporan/revisi/waktu persetujuan. Inspector membaca total proyek tetapi rincian sumber hanya miliknya. Pilihan pekerjaan tidak mengubah total proyek. Kelompok tidak menjumlah volume dari satuan berbeda.

**Migration/data:** tidak membutuhkan migration baru atau tabel cache. Pemeriksaan hanya-baca membandingkan delapan `name/checksum/applied_at` dengan catatan sebelum T07 dan mencocokkan SHA-256 file 001–008; semuanya sama. Tidak mereset database, mengubah history, atau menulis data bisnis utama. Semua fixture memakai schema tes acak terisolasi. Backend utama tetap merespons `/api/health` 200 dan `/api/auth/me` 401 tanpa sesi; tidak ada ECONNREFUSED pada pemeriksaan akhir.

| Pemeriksaan | Hasil aktual |
| --- | --- |
| `npm.cmd run build` | Lulus: typecheck frontend/backend/tes, Vite, kompilasi server dan salin migration |
| `npm.cmd test` | **64/64 lulus** dalam satu run akhir |
| `$env:PLAYWRIGHT_CHANNEL='msedge'; npm.cmd run test:ui` | **38/38 lulus** dalam satu run, desktop 1280×900 dan HP 390×844 |
| `npm.cmd run test:smoke` | Lulus: server development/build/restart, progress tetap 10% dari satu sumber sah setelah pembukaan ulang |
| Riwayat/checksum database utama | Delapan migration tetap identik dengan catatan sebelum T07 |

Tes mencakup 250/1.000 berbobot 10% menghasilkan 2,5%, koreksi 250→200 menjadi 2%, draft/SUBMITTED/NEEDS_REVISION tidak dihitung, approval ganda satu efek, dua approval 600+600 pada kontrak 1.000 hanya satu diterima, sumber lama tetap tersimpan, penjumlahan periode, revisi rencana mempertahankan seluruh aktual, pembagi nol, cutoff, bulan kabisat, angka besar dan deviasi 42−45=−3. Regresi browser memeriksa halaman progress, filter, tautan sumber, pemulihan gagal, serta alur T00–T06. Screenshot desktop/HP berada di folder hasil tes T07.

**Kegagalan selama validasi:** fixture awal memakai tanggal/pembuat yang sama untuk dua laporan; setelah tanggal diganti, rincian material/masalah masih bertanggal lama. Fixture draf diganti menggunakan `emptyReport` pada tanggal berbeda. Ekspektasi lintas proyek diperbaiki dari 403 ke kontrak 404 yang menyembunyikan keberadaan proyek. Tidak melonggarkan validasi aplikasi; tes terarah dan seluruh suite kemudian lulus.

**Keputusan/keterbatasan:** D58–D64 di `docs/decisions.md`. API membulatkan enam desimal hanya pada hasil akhir; angka tampilan dapat berselisih satu unit desimal terakhir ketika dijumlah. Periode lama memakai sumber sah saat ini, bukan snapshot persetujuan pada timestamp lampau. Belum ada pagination sumber, materialisasi, grafik, rekap mingguan/bulanan atau ekspor; prototype belum production. README, arsitektur dan panduan penggunaan diperbarui.

**Cara mencoba:** masuk → Proyek → pilih proyek → Progress Proyek. Pilih tanggal/versi/pekerjaan lalu Tampilkan Progress. **Langkah berikutnya:** T08, laporan mingguan/bulanan memakai service progress yang sama.

### 30 September 2026 — T08 laporan mingguan dan bulanan

**Perubahan:** `shared/period-reports.ts`, `server/services/period-reports.ts` dan endpoint `GET /api/projects/:id/period-reports` menyediakan pilihan jenis, nomor periode dan versi pembanding. Halaman `/proyek/:id/laporan-berkala` ditautkan dari detail proyek. Identitas kontrak, jadwal, hari ke-/sisa hari, volume/harga/nilai/bobot, partisi fisik/tertimbang, target, deviasi, total dan keterangan pekerjaan tersedia. Rincian tenaga kerja, material/alat dan masalah ditampilkan menurut laporan sumber sah, berikut revisi dan identitas pemeriksa.

**Konsistensi:** inti T07 diekstrak sebagai `progressInTransaction`, tetap dipakai oleh endpoint progress dan oleh laporan berkala dalam transaksi dengan SHARE lock proyek yang sama. Tidak ada perhitungan aktual ulang di frontend, tabel rekap manual, cache, migration baru, atau perubahan database bisnis utama. Delapan `name/checksum/applied_at` database utama cocok dengan catatan sebelum T07, dan seluruh SHA-256 file migration cocok dengan database.

**Bukti validasi:**

| Perintah/pemeriksaan | Hasil |
| --- | --- |
| `npm.cmd run build` | Lulus: typecheck, Vite, kompilasi backend, salin migration |
| `npm.cmd test` | 66/66 lulus dalam satu run |
| `node --env-file-if-exists=.env --import tsx --test --test-name-pattern=T08 tests/reports.test.ts` | 2/2 lulus; pemeriksaan ulang setelah guard jadwal 3.660 hari dan tambahan kasus naratif |
| `npm.cmd run test:smoke` | Lulus, termasuk rekap bulanan 10% dari satu sumber sah lintas restart development/build |
| Browser terarah `tests/browser/progress.spec.ts` | 4/4 desktop/HP lulus; pilihan minggu/bulan, sumber, empty state Owner dan pemulihan error |
| `$env:PLAYWRIGHT_CHANNEL='msedge'; npm.cmd run test:ui` | 40/40 lulus dalam satu run desktop/HP (5,6 menit); screenshot rekap diperiksa |
| `npm.cmd run typecheck` setelah tambahan tes terakhir | Lulus |

Tes T08 memeriksa batas 22/23 Juli dan 15/16 Agustus, bulan terakhir 16–18 Agustus (3 hari), periode tanpa laporan membawa angka sebelumnya, dan angka laporan identik dengan API progress. Revisi rencana dibandingkan pada batas periode sama tanpa mengubah aktual/sumber. Draf/pending tidak masuk rincian, koreksi mengganti sumber dan child data, naratif sah masuk rincian tanpa menambah progress, akses lima role serta penolakan tanpa sesi/lintas proyek/parameter tidak sah, Inspector terbatas, dan arsip tetap terbaca. Tes periode T04 yang turut lulus mencakup bulan kabisat serta pergantian tahun.

**Keputusan/batas:** D65–D70. Jadwal rekap mencakup akhir terjauh kontrak/rencana terbit; pilihan versi hanya pembanding. Perpanjangan baru dapat memperpanjang periode terakhir yang sebelumnya parsial. Identitas kontrak terkini dibedakan dari basis baseline tetap; rekap web bukan snapshot ekspor historis. Pengesahan adalah identitas persetujuan laporan sumber, bukan tanda tangan atau approval rekap tersendiri. Rincian tenaga kerja tidak diklaim sebagai orang unik lintas periode, dan material beda satuan tidak dijumlahkan. Belum ada pagination sumber. Grafik T09, PDF/Excel dan kesetaraan template workbook T10 belum dikerjakan; tetap prototype.

**Dokumentasi:** README, arsitektur, keputusan, rencana implementasi dan cara-pakai diperbarui. **Cara mencoba:** Proyek → pilih proyek → Laporan Mingguan dan Bulanan → pilih jenis/periode/rencana → Tampilkan Laporan. **Berikutnya:** T09 ringkasan, grafik, galeri dan riwayat.

### 30 September 2026 — T09 ringkasan, grafik, galeri dan riwayat

**Implementasi:** `/ringkasan` menampilkan pilihan proyek dan isi sesuai lima role. Administrator mendapat jumlah proyek/pengguna serta aktivitas sistem; TL antrean pemeriksaan dan perubahan rencana; Engineer catatan teknis; Inspector hitungan/laporan miliknya; Owner informasi dari sumber yang boleh diakses. Halaman `/proyek/:id/ringkasan` juga ditautkan dari detail proyek. Kartu aktual/target/deviasi/hari/sisa hari/nilai kontrak, pekerjaan berjalan, masalah dan dokumentasi terbaru berasal dari database.

**Grafik:** tiga seri baseline, versi terakhir terbit/pembanding dan aktual memakai loader/kalkulator T07. Akhir periode dan cut-off menjadi titik grafik; sumbu tanggal proporsional. Tabel angka dan tooltip mendampingi SVG responsif. Aktual setelah cut-off null. Kartu tetap menggunakan versi efektif, sehingga rencana masa depan tidak otomatis aktif. Pemilihan versi pembanding tidak mengubah aktual.

**Galeri/riwayat:** filter tanggal pengambilan, pekerjaan, laporan dan pengunggah digabung dengan otorisasi proyek. Owner tidak menerima foto/catatan draf atau pending correction; Inspector hanya rincian miliknya. Galeri memakai endpoint foto privat yang memeriksa akses kembali. Riwayat menampilkan DTO terbatas berisi pelaku/waktu/tindakan/alasan/versi/tautan, tanpa JSON audit mentah. Status laporan diberi label keadaan saat ini.

**Status proyek:** service proyek memakai volume eksak sumber sah. Semua item berbobot positif terpenuhi → Selesai; belum selesai setelah akhir rencana efektif → Terlambat; selain itu mengikuti aktual/tanggal mulai. Override manual beralasan tetap berlaku. Tidak memakai persen tampilan yang telah dibulatkan atau tanda deviasi untuk menetapkan status.

**Migration/data:** tidak ada migration baru, reset, atau perubahan history manual. Delapan `name/checksum/applied_at` database utama cocok dengan catatan sebelumnya dan SHA-256 file SQL cocok dengan database. Data sintetis hanya ditulis pada schema tes terisolasi. Tidak ada dependency grafik tambahan.

| Validasi | Hasil aktual |
| --- | --- |
| `npm.cmd run build` | Lulus: typecheck, Vite, backend dan salin migration |
| `npm.cmd test` | 68/68 lulus dalam satu run |
| Tes backend dengan `--test-name-pattern=T09` | 2/2 lulus ulang setelah query daftar proyek diserialisasi pada satu client PostgreSQL |
| Browser terarah `tests/browser/progress.spec.ts` | 6/6 desktop/HP lulus, termasuk ulang setelah perbaikan grafik HP (40,5 detik): progress/rekap/monitoring, filter foto, riwayat, kartu Administrator dan pemulihan gagal |
| `$env:PLAYWRIGHT_CHANNEL='msedge'; npm.cmd run test:ui` | 42/42 lulus dalam satu run desktop/HP (5,6 menit) |
| `npm.cmd run test:smoke` | Lulus, termasuk monitoring/kurva 10% serta satu foto sah lintas restart development/build |
| History/checksum DB utama | Delapan migration tetap identik |

Pengujian membuktikan akses lima role, pencabutan penugasan, penolakan tanpa sesi/lintas proyek, filter gabungan, tidak bocornya catatan/foto/pending correction kepada Owner, kurva sama dengan API progress, perubahan pembanding menjaga aktual, keadaan tanpa baseline, status selesai berdasarkan sumber sah dan override manual. Regresi T06 upgrade migration juga tetap lulus. Screenshot monitoring/riwayat desktop dan HP berada pada folder hasil tes progress.

**Catatan validasi:** proses sempat terhenti karena pemeriksaan persetujuan otomatis gagal akibat batas penggunaan layanan, bukan penilaian bahwa perintah tes tidak aman. Setelah pengguna meminta lanjut, perintah dijalankan kembali secara normal. Peringatan pg tentang query paralel pada client yang sama diselesaikan dengan pembacaan daftar proyek berurutan; tes T09 diulang lulus. Pemeriksaan screenshot menemukan label sumbu grafik HP terlalu kecil; grafik diberi lebar minimum dan area geser yang dapat difokuskan dengan keyboard. Build akhir lulus; browser terkait diulang setelah perubahan tampilan.

**Keputusan/keterbatasan:** D71–D77 pada `docs/decisions.md`. Antrean/catatan/galeri/riwayat adalah keadaan terkini, bukan snapshot historis mengikuti cut-off grafik. Foto arsip APPROVED tetap boleh dibaca. Riwayat/galeri belum dipaginasi dan belum ada uji beban production. PDF/Excel serta kesetaraan template workbook tetap T10. Tidak ada klaim siap production.

**Cara mencoba:** menu Ringkasan → pilih proyek → Ringkasan Proyek/Galeri/Riwayat. Alternatif: detail proyek → Ringkasan, Grafik, Galeri dan Riwayat. **Berikutnya:** T10 ekspor dan penyelesaian P3.

### 30 September 2026 — T10 ekspor dan penyelesaian P3

**Implementasi:** delapan keluaran tersedia melalui `/proyek/:id/ekspor` dan `/api/projects/:id/exports`: harian, mingguan, bulanan, progress, grafik rencana/aktual, tenaga kerja, material/alat dan masalah. Satu DTO dipakai pratinjau web, PDF asli dan XLSX asli. Sumber progress tetap service T07–T09; tidak ada perhitungan bisnis kedua di renderer. Metadata memuat proyek, periode/cut-off, versi dan waktu pembuatan. Pembacaan foto memakai transaksi yang sama agar tidak menunggu koneksi pool kedua.

**Format:** PDF A3 mendatar dengan font Noto Sans, header tabel berulang, nomor halaman, foto dan grafik. XLSX menyimpan angka numerik, header beku/filter, judul cetak berulang, foto, gambar grafik beserta tabel angkanya. Teks pengguna tetap string, bukan formula. Lembar Nilai Eksak menyimpan angka sumber sebelum batas presisi Excel. Tinggi baris menyesuaikan teks; nilai yang sangat panjang tetap tersedia lewat sel/bilah formula atau PDF.

**Rekap/filter:** orang-hari dan orang-jam dipisahkan dari individu unik; material diterima/ditolak dan satuannya dipisahkan. Koreksi sah menggantikan rincian lama, pending correction tidak mengubah rekap. Filter laporan menggabungkan proyek terpilih, tanggal, minggu/bulan proyek, status dan pembuat. Pencarian proyek yang sudah ada dipertahankan. Respons pencarian/filter lama dicegah menimpa pilihan terbaru.

**Migration/data:** tidak ada migration baru, reset, pengubahan history atau penulisan data bisnis sintetis ke schema utama. Pembacaan PostgreSQL utama membuktikan delapan `name/checksum/applied_at` identik dengan catatan sebelumnya; SHA-256 semua SQL cocok. Pengujian memakai schema, upload dan port terisolasi.

| Validasi | Hasil aktual |
| --- | --- |
| `npm.cmd run build` | Lulus: typecheck frontend/backend/tes, Vite dan salin migration |
| `npm.cmd test` | 70/70 backend lulus dalam satu run |
| Tes terarah `--test-name-pattern=T10` | 2/2 lulus ulang setelah tambahan koreksi/material/periode kosong serta pemformatan akhir |
| Browser terarah awal progress | 6/6 desktop/HP lulus, termasuk delapan pratinjau, unduhan dan filter |
| Regresi browser lengkap awal | 40/42 lulus; dua kegagalan diselidiki dan diperbaiki sebagaimana catatan berikut |
| Browser `progress.spec.ts reports.spec.ts projects.spec.ts` setelah perbaikan | 18/18 desktop/HP lulus, termasuk tes baru respons pencarian terlambat |
| Browser final setelah perlindungan filter laporan | 10/10 lulus dalam satu run desktop/HP (2,3 menit), termasuk respons laporan terlambat |
| `npm.cmd run test:smoke` | Lulus, termasuk magic bytes PDF/XLSX setelah restart development/build dan persistensi data sebelumnya |
| Pemeriksaan visual | PDF dibuka di Edge; tabel panjang sintetis 27 halaman menampilkan header berulang dan isi terbaca. Grafik berlabel panjang dan screenshot HP diperiksa |
| History/checksum DB utama | Delapan migration tetap identik |

**Perbaikan dari validasi:** tanda `?` kosong pada URL daftar laporan mengganggu skenario pemulihan koneksi, sehingga URL tanpa filter kembali memakai path biasa. Hasil pencarian proyek yang lebih lambat dapat menimpa respons filter terbaru; nomor permintaan mencegah pembaruan stale, dengan regresi browser yang sengaja menunda respons lama. Perlindungan sama diterapkan pada daftar laporan. Pemeriksaan XLSX juga memperbaiki tinggi baris yang sebelumnya dapat menjadi NaN akibat slot kosong pada array sel. Tes baca ulang memastikan tinggi valid dan teks panjang terbungkus.

**Batas/keputusan:** D78–D85. Workbook contoh memiliki 13 lembar, formula eksternal dan periode berbeda; ekspor tidak diklaim identik dengan template tersebut. Kesamaan web/PDF/XLSX diuji pada data SIMP. Grafik XLSX berupa gambar dengan data sumber. Unduhan membaca ulang keadaan terbaru, bukan snapshot pratinjau tersimpan. Dua temuan audit moderat ExcelJS/UUID dicatat; alur ini memakai UUID v4, bukan API buffer v3/v5/v6 pada advisory. Tidak ada klaim siap production atau uji beban ekspor besar.

**Dokumentasi/cara mencoba:** Proyek → pilih proyek → Ekspor PDF dan Excel → pilih jenis/periode → Tampilkan Pratinjau → Unduh PDF/Excel. Panduan lengkap dan perbandingan workbook: [ekspor](ekspor.md). README, arsitektur, cara-pakai dan keputusan diperbarui. T10 selesai. Tahap berikutnya T11 validasi akhir dan paket demo.

### 1 Oktober 2026 — Penyesuaian T10 mengikuti layout workbook

**Permintaan:** layout harus sesuai workbook. Ketentuan ini menggantikan keputusan format bebas pada catatan T10 sebelumnya (D84); keputusan terbaru D86–D89.

**Implementasi:** `scripts/extract-workbook-layout.mjs` mengekstrak geometri, gabungan sel, style, label tetap, pengaturan cetak serta logo kop menjadi `server/templates/workbook-layout.json`. Workbook sumber tidak diubah (SHA-256 `d8861acf3d676d1eea97d9d2ddf60b151d0399d881818859075dbf1d75ffa51e`). Data bisnis contoh, cache formula, nama penandatangan serta foto contoh tidak dipakai. Logo kop sengaja dipertahankan sebagai gambar contoh dan dapat dimatikan melalui pilihan **Gunakan logo dari workbook contoh**.

`workbook-layout.ts` memetakan data aplikasi ke H0 (harian/rincian), M1 (mingguan/progress), B1 (bulanan) dan TS (kurva). `workbook-print.ts` menghasilkan pratinjau dan pembagian halaman berdasarkan geometri sumber. PDF diawali formulir A4 sesuai orientasi template, lalu lampiran teks A3. Excel diawali lembar formulir, lalu rincian dan nilai eksak. Build menyalin aset template agar hasil build tetap dapat mengekspor. Halaman lanjutan menjaga pekerjaan yang melebihi kapasitas formulir.

**Validasi aktual:**

| Pemeriksaan | Hasil |
| --- | --- |
| `npm.cmd test` | 72/72 lulus sebelum penyempurnaan logo/warna/label terakhir |
| Tes terarah T10/layout pada exports, reports dan workbook-layout | 4/4 lulus setelah penyempurnaan logo, XML, warna serta kurva |
| `tests/workbook-layout.test.ts` setelah perbaikan label bulanan terakhir | 2/2 lulus; geometri, angka, logo, halaman lanjutan, teks literal dan label konsultan diperiksa |
| Browser `tests/browser/progress.spec.ts` | 6/6 desktop/HP lulus; delapan jenis pratinjau, pemuatan SVG, pilihan logo, unduhan dan overflow |
| `npm.cmd run build` | Lulus ulang setelah perubahan kode terakhir |
| `npm.cmd run test:smoke` | Lulus; ekspor development/build dan persistensi lintas restart |
| Pemeriksaan visual sintetis | Formulir mingguan, harian dan bulanan diperiksa; artefak PNG/PDF/XLSX di `.tmp/workbook-layout/` |

**Data dan batas:** tidak ada perubahan migration, reset database atau pengubahan migration history. Tes memakai data sintetis/schema terisolasi. Periode dan sumber progress aplikasi tetap sama. PPN serta pembulatan tidak diasumsikan dari contoh; nilainya kosong. Pengesahan tetap diisi pihak berwenang. Font PDF dapat berbeda dari Excel karena formulir dirender sebagai gambar resolusi tinggi; lampiran teks mempertahankan rincian lengkap ketika isi panjang tidak muat. Logo masih memuat identitas instansi/perusahaan contoh jika pilihan logo aktif. Belum merupakan paket production.

**Cara mencoba:** Proyek → Ekspor PDF dan Excel → pilih jenis/periode dan pengaturan logo → Tampilkan Pratinjau → Unduh PDF/Excel. Panduan `docs/ekspor.md`, `docs/cara-pakai.md`, arsitektur, keputusan dan README diperbarui. T10 tetap selesai; T11 belum dimulai.

### 1 Oktober 2026 — T11 validasi akhir, paket demo dan pekerjaan workbook TS

**Cakupan:** validasi PRD §79–82/§86–88 dan penutupan T00–T11. Arahan tambahan pengguna: gunakan uraian pekerjaan sheet TS untuk demo, bukan daftar pekerjaan dummy. Data sintetis hanya untuk pengujian otomatis terisolasi.

**Implementasi:** `tests/browser/acceptance.spec.ts` menyatukan alur lima role melalui UI: Admin membuat akun, TL membuat proyek/pekerjaan/rencana/tim teknis, Admin menugaskan Owner, Inspector mengisi kegiatan/tenaga/cuaca/material/masalah/foto, Engineer mencatat, TL meminta perbaikan lalu menyetujui, Owner memonitor. Cabang revisi dan koreksi membuktikan aktual 25% tidak berubah karena target atau pending correction, kemudian menjadi 20% sesudah koreksi sah; versi dan foto lama tetap tersedia. Akses proyek/ekspor tanpa penugasan ditolak.

`scripts/extract-workbook-work.mjs` mengambil 45 baris TS (7 kelompok/38 item) dengan satuan, volume dan harga M1. Asset bersumber jelas ada di `server/templates/workbook-work.json`. Pratinjau dan impor tersedia pada Daftar Pekerjaan melalui API `work-items/workbook`; hak Admin/TL, hash sumber, proyek kosong, basis belum terkunci dan transaksi dengan lock proyek melindungi data. Semua baris serta audit masuk bersama; klik ganda tidak menduplikasi. Uraian dibandingkan terhadap workbook dalam tes. Volume M1!H26 dibulatkan dari `622.1201983` ke `622.120198`, ditampilkan saat pratinjau dan dicatat sebagai sumber. Formula volume langsung H35/H37 ditelusuri ke angka lokal, bukan cache eksternal. Target, aktual, approval dan tanda tangan tidak diimpor.

**Dokumen:** [panduan demo](demo-guide.md) memuat setup, bootstrap/akun, data workbook, langkah lima role, revisi/koreksi, perintah dan batas. [hasil penerimaan](acceptance-results.md) memetakan kelompok PRD ke bukti. README, cara-pakai, arsitektur serta keputusan D90–D92 diperbarui.

| Validasi | Hasil aktual |
| --- | --- |
| `npm.cmd test` | 74/74 lulus dalam satu run (145 detik), termasuk impor/hak akses/konkurensi dan perbandingan seluruh uraian TS |
| Browser T11 terarah awal | 2/2 desktop/HP lulus setelah penugasan Owner diperbaiki pada skenario |
| Regresi browser lengkap | 46/48 lulus; dua kegagalan tes pemilihan akun lama dijelaskan di bawah |
| Regresi terkait setelah perbaikan | 10/10 lulus dalam satu run (4,7 menit): acceptance, reviews, work-items dan workbook-import pada desktop/HP |
| `npm.cmd run build` | Lulus ulang setelah kode, tes dan perapian tampilan nilai besar; typecheck serta aset template ikut diperiksa |
| `npm.cmd run test:smoke` | Lulus; migration/bootstrap schema kosong, restart backend development/build, persistensi akun/sesi/proyek/rencana/laporan/foto, ekspor dan akses berkas privat |
| Database utama, pembacaan saja | 8 migration; seluruh checksum berkas cocok dengan database |
| Lint | Tidak dijalankan karena tidak ada script/linter terkonfigurasi |
| Pemeriksaan visual | Screenshot Owner pada HP dan pekerjaan TS pada desktop diperiksa; nilai besar dirapikan agar tidak terpotong pada satu digit terakhir |

**Temuan/perbaikan tes:** percobaan awal T11 memilih Owner lewat TL sehingga menunggu opsi yang memang tidak diizinkan. Skenario diperbaiki agar Admin menugaskan Owner, tanpa memperluas izin aplikasi. Regresi lengkap kemudian mengungkap tes T06 memilih kandidat pertama berdasarkan role; akun baru T11 menyebabkan akun lain ditugaskan, lalu Inspector fixture mendapat 404. Pemilihan diperbaiki memakai nama akun fixture yang tepat. Pengulangan menjalankan T11 lebih dahulu untuk mereproduksi keberadaan banyak akun sebelum memeriksa alur T06. Kegagalan awal tetap dicatat.

**Data/batas:** tidak ada reset database utama, migration baru, perubahan history atau pengisian otomatis proyek lama. Pengguna memilih proyek kosong saat menekan tombol impor TS. Tes memakai schema/foto/port terisolasi; smoke menguji restart backend, bukan mematikan layanan PostgreSQL pengguna. Batas renderer, periode, basis kontrak, dependency serta kesiapan production tetap tercatat pada acceptance-results. **Penutupan:** T11 selesai; seluruh T00–T11 ditutup sebagai prototype. Tidak ada cacat kritis yang diketahui masih terbuka dari validasi ini. Langkah berikutnya: jalankan demo memakai proyek kosong dan impor TS melalui UI, lalu catat umpan balik untuk iterasi berikutnya. Tidak ada klaim siap production.

### 1 Oktober 2026 — Perbaikan kolom Nama kontraktor

**Permintaan:** pengguna menemukan kolom kontraktor belum tersedia pada Tambah Proyek dan meminta diperbaiki. Kolom baru berada pada langkah Identitas dan pihak terkait, terpisah dari pemberi pekerjaan/instansi/konsultan; tersedia juga pada Ubah Proyek dan detail proyek. Batas 250 karakter, trim, boleh kosong. Update dari payload lama yang belum mengirim kolom ini mempertahankan nilai yang sudah tersimpan.

**Database:** migration baru `009_project_contractor.sql` menambahkan `projects.contractor_name` dengan default kosong. Tidak mengubah SQL 001–008, menghapus data atau mengedit history secara manual. Pemeriksaan database utama mendapati 009 sudah diterapkan; `npm.cmd run db:migrate` kemudian lulus dengan 0 migration baru (idempoten). Sembilan checksum cocok dengan file. Sidik data proyek dan history sebelum/sesudah pemeriksaan tidak berubah; tes upgrade 008→009 tersendiri membuktikan semua kolom lama serta history 001–008 dipertahankan. Backend utama `/api/health` merespons 200.

**Laporan:** ringkasan harian menampilkan nama kontraktor dengan label data proyek saat ini. Delapan jenis ekspor memasukkan nama dari PostgreSQL ke metadata; layout M1/B1 menampilkan pada kop dan organisasi pelaksana, TS pada organisasi kontraktor, H0 pada identitas laporan. Nama penandatangan tidak diisi otomatis, angka/approval/snapshot kegiatan tidak berubah. Nama/logo contoh tidak dijadikan nilai kontraktor proyek lama. Keputusan D93.

| Validasi | Hasil aktual |
| --- | --- |
| `npm.cmd test` | Awalnya 74/75 lulus; satu fixture upgrade historis perlu perbaikan sebagaimana catatan berikut |
| Tes terarah `T06 migration\|T10` pada `tests/reports.test.ts` | 2/2 lulus setelah perbaikan; mencakup upgrade historis serta nama kontraktor pada delapan jenis ekspor |
| Browser `projects.spec.ts reports.spec.ts progress.spec.ts` | 18/18 desktop/HP lulus; tambah/ubah kontraktor, reload, hak akses, laporan dan ekspor |
| `npm.cmd run build` | Lulus ulang setelah perubahan terakhir, termasuk typecheck |
| `npm.cmd run test:smoke` | Lulus: startup development/build, restart dan persistensi data/foto |
| Layout workbook | Tes angka/nama kontraktor pada sel dan hasil XLSX lulus; kop/organisasi pelaksana diperiksa pada gambar mingguan sintetis |

**Perbaikan fixture:** skenario migration T05 menggunakan writer proyek modern yang kini memerlukan kolom 009. Fixture diganti dengan INSERT schema historis hanya pada schema tes. Percobaan awal masih menugaskan TL melalui service penugasan umum yang memang melarang pembuatan penugasan TL baru; fixture penugasan historis ikut diperbaiki tanpa mengubah aturan aplikasi. Regresi upgrade kemudian lulus, termasuk pemeriksaan checksum 007 asli dan data/foto lama. Tidak ada kegagalan terkait yang tersisa.

**Cara mencoba:** muat ulang aplikasi → Tambah Proyek → Identitas dan pihak terkait → Nama kontraktor. Untuk proyek lama pilih Ubah Proyek, isi nama dan simpan, lalu buat ulang pratinjau/unduhan laporan. Panduan cara-pakai, arsitektur, keputusan dan rencana diperbarui. Perbaikan selesai; batas prototype tetap berlaku.

### 2 Oktober 2026 — Redesign UI/UX menyeluruh untuk prototype

**Cakupan:** rencana redesign yang disetujui diterapkan bertahap pada kerangka aplikasi, dashboard, proyek/pengguna/tim, pekerjaan/rencana, laporan/persetujuan, kemajuan/rekap/dokumentasi/ekspor, serta halaman awal dan masuk. Struktur route dan lima bagian proyek tetap dipertahankan. Dashboard kini mendahulukan hal yang perlu perhatian dan proyek yang dapat diakses sesuai role. Navigasi desktop memakai sidebar tetap; HP memakai app bar, side sheet, tombol kembali, dan pemilih bagian proyek.

**Design system dan komponen:** `@carbon/react` 1.117.0 serta `sass` ditambahkan. Style Carbon diimpor hanya untuk komponen yang digunakan. Token SIMP, layout responsif, tipografi, status, form, tabel, action bar, disclosure, halaman publik dan aturan HP berada di `client/src/redesign.scss` serta `client/src/carbon.scss`. Adapter bersama di `client/src/components/ui.tsx` mencakup PageHeader, MetricTile, StatusTag, ActionBar, FilterPanel, FormSection, EmptyState, LoadingPanel, ConfirmActionModal dan HistoryTimeline. Dialog browser untuk tindakan penting diganti modal yang memiliki nama dan fokus. Pedoman lengkap tersedia di [design-system.md](design-system.md), panduan navigasi di [ui-ux.md](ui-ux.md), dan README/cara-pakai telah diselaraskan.

**Penyajian:** ringkasan memakai dua desimal sementara rincian teknis tetap enam desimal; status selalu memiliki teks; metadata workbook/perhitungan dipindahkan ke rincian; riwayat memakai timeline; keadaan loading/kosong/gagal diseragamkan. Layout workbook, delapan jenis ekspor, data TS, serta angka dari API tidak diubah. Tangkapan layar desktop dan HP seluruh alur tersimpan pada `test-results/` dan diperiksa pada halaman awal, dashboard lima role, proyek, form laporan, persetujuan, kemajuan, rencana, pekerjaan, dan impor TS.

**Runner pengujian:** `scripts/browser-test.ts` kini menjalankan backend dan Vite sebagai child process langsung, lalu menutup keduanya setelah Playwright selesai. Ini memperbaiki proses Playwright Windows yang sebelumnya sudah menyelesaikan semua skenario tetapi menunggu penghentian web server. `playwright.config.ts` dapat melewati web server internal ketika runner tersebut sudah menyiapkan layanan. Tidak ada proses development pengguna yang dihentikan.

**Migration/data:** tidak ada migration, reset database, perubahan history, perubahan schema, atau penulisan data dummy ke database utama. Seluruh pengujian memakai schema PostgreSQL dan folder unggahan terisolasi. API, autentikasi, role, permission, route, perhitungan kemajuan, alur persetujuan, struktur laporan, dan format workbook tetap sama.

| Validasi | Hasil aktual |
| --- | --- |
| `npm.cmd run typecheck` | Lulus |
| `npm.cmd run build` | Lulus; 257 modul, CSS 232,14 kB (gzip 26,71 kB), JS 588,53 kB (gzip 169,27 kB) |
| Backend terkompilasi: `node --env-file-if-exists=.env --test --test-concurrency=1 dist/tests/*.test.js` | 75/75 lulus dalam 207,8 detik |
| `$env:SIMP_TEST_BUILT='true'; $env:PLAYWRIGHT_CHANNEL='msedge'; node --env-file-if-exists=.env dist/scripts/browser-test.js` | 62/62 lulus dalam 12,4 menit pada desktop/HP; keluar normal dengan kode 0 |
| `$env:SIMP_SMOKE_BUILT_ONLY='true'; npm.cmd run test:smoke` | Lulus: migration/bootstrap schema tes, restart server build, persistensi data/foto, ekspor, routing dan berkas privat |
| Pemeriksaan visual | Dashboard Team Leader desktop/HP, form laporan HP dan monitoring desktop diperiksa; hierarki serta area scroll sesuai rancangan |

**Riwayat kegagalan yang relevan:** regresi browser pertama setelah perubahan lulus 56/62. Satu teks empty state dan lima locator navigasi HP masih mengikuti markup lama; keduanya diperbaiki, tes terarah lulus, lalu regresi penuh diulang menjadi 62/62. Runner lama juga tidak selesai setelah baris tes terakhir karena child web server Windows tetap hidup; lifecycle runner diperbaiki dan pengulangan keluar dengan kode 0. `npm.cmd test` dan smoke server TypeScript langsung sempat gagal sebelum kode aplikasi dijalankan karena `uv_os_get_passwd returned ENOMEM` dari loader `tsx` pada lingkungan Windows. Jalur terkompilasi lulus 75/75; smoke build juga lulus. Kegagalan lingkungan tersebut tidak disamakan dengan kelulusan jalur source.

**Batas dan risiko tersisa:** Sass menampilkan peringatan deprecation dari internal Carbon, dan Vite memberi peringatan chunk JavaScript di atas 500 kB walaupun gzip 169,27 kB. Belum ada uji penggunaan langsung bersama petugas lapangan atau audit aksesibilitas dengan pembaca layar. Redesign ini tetap prototype dan bukan klaim siap production.

**Langkah berikutnya:** jalankan demo pada HP bersama satu pengguna tiap role, catat tugas yang masih membingungkan, lalu prioritaskan iterasi berdasarkan waktu penyelesaian laporan dan pemeriksaan nyata.

Tambahkan satu entri saat menjalankan tahap: tanggal, tahap, perubahan/berkas penting, migration dan cara menjalankannya, perintah verifikasi beserta hasil aktual, keputusan/asumsi baru, hambatan tersisa, serta satu langkah berikutnya yang konkret. Jangan menulis data rahasia. Jangan menghapus catatan kegagalan yang masih relevan atau menyamakan tes belum dijalankan dengan lulus.

### 3 Oktober 2026 — Dashboard operasional Team Leader dan navigasi proyek langsung

**Cakupan:** rencana redesign lanjutan diterapkan sebagai satu rangkaian. Sidebar semua role kini memiliki pemilih proyek aktif dan delapan tujuan langsung: Ringkasan, Laporan Harian, Rekap & Unduhan, Daftar Pekerjaan, Jadwal & Target, Dokumentasi, Tim, dan Informasi Proyek. Pergantian proyek mempertahankan bagian aktif bila tersedia. Header proyek dipadatkan dan navigasi lokal besar di dalam halaman dihapus. Struktur HP memakai drawer dengan tujuan yang sama.

**Dashboard Team Leader:** `/ringkasan` menjadi pusat pemantauan operasional yang menggunakan data nyata: pilihan proyek, status/tanggal data, empat KPI, kurva target–aktual, capaian per periode, pusat tindakan, serta tabel seluruh proyek yang diurutkan berdasarkan kebutuhan perhatian. Kontrak `GET /api/dashboard` diperluas secara kompatibel melalui `projectSummaries`, `inProgress`, dan `delayed`; field lama tetap tersedia. Perhitungan memakai service kemajuan yang sama dengan halaman rincian. Tidak ada rumus frontend atau data contoh baru.

**Penyajian halaman:** daftar proyek, laporan, pekerjaan, anggota tim, dan target diubah menjadi tabel adaptif. Pada HP, tabel sederhana menjadi baris label–nilai dengan divider; tabel pekerjaan tetap memakai area gulir khusus karena struktur hierarkisnya lebar. Detail laporan memakai tabel kegiatan/sumber daya, sedangkan informasi tunggal dan form ditata lebih datar. Kartu dipertahankan untuk KPI, perhatian penting, dan foto. Berkas utama: `client/src/components/ProjectSidebar.tsx`, `client/src/components/ProjectNavigation.tsx`, `client/src/pages/MonitoringViews.tsx`, `Projects.tsx`, `Reports.tsx`, `WorkItems.tsx`, `ProjectTeam.tsx`, `Plans.tsx`, `client/src/redesign.scss`, `shared/monitoring.ts`, dan `server/services/monitoring.ts`.

**Migration/data:** tidak ada migration, perubahan schema, reset database, perubahan history, atau data dummy baru. Autentikasi, route, role, permission, workflow laporan, formula kemajuan, dan format ekspor tetap dipertahankan. Pengujian memakai schema serta upload terisolasi.

| Validasi | Hasil aktual |
| --- | --- |
| `npm.cmd run build` | Lulus; typecheck frontend/backend, Vite, kompilasi server, dan salin migration selesai. Vite membangun 266 modul. |
| Backend terkompilasi dengan shim lingkungan Windows | 75/75 lulus; termasuk kontrak ringkasan dashboard baru. |
| Tes terarah acceptance, review, pekerjaan, dan impor workbook | Percobaan awal menemukan locator presentasi lama; setelah diselaraskan, acceptance/review lulus dan pekerjaan/impor 6/6 lulus desktop/HP. |
| Regresi browser lengkap pertama | 61/62 lulus; satu tes HP Team Leader masih mencari tautan proyek lama pada dashboard baru. Fungsi dan empat role lain lulus. |
| Navigasi setelah perbaikan locator pemilih proyek | 14/14 lulus desktop/HP untuk lima role, filter URL, kembali, rekap, dan unduhan. |
| Regresi browser final | 62/62 lulus dalam satu run 13,0 menit pada desktop dan HP; `.last-run.json` berstatus `passed`. |

**Catatan:** teks mojibake yang sempat muncul akibat penulisan ulang berkas UTF-8 pada beberapa halaman dipulihkan sebelum validasi final. Build masih menampilkan peringatan deprecation Sass dari internal Carbon dan peringatan chunk JavaScript 608,28 kB (gzip 173,43 kB); keduanya tidak menggagalkan build. Belum ada uji langsung bersama petugas lapangan atau audit pembaca layar, sehingga hasil tetap berstatus prototype.

**Dokumentasi:** `docs/design-system.md` dan `docs/ui-ux.md` kini menjelaskan delapan tujuan proyek, pemilih proyek, dashboard Team Leader, tabel adaptif, form datar, dan batas penggunaan kartu.

**Langkah berikutnya:** lakukan sesi penggunaan singkat di HP bersama satu Team Leader dan satu Inspector menggunakan proyek nyata, lalu catat waktu menemukan laporan tertunda, memeriksa laporan, dan mengganti proyek sebagai dasar iterasi berikutnya.

### 5–6 Oktober 2026 — UI ringkas berdasarkan referensi pengguna

**Cakupan:** menerapkan persetujuan redesign dengan acuan `simp-prototype`, `redesign-existing-projects`, dan bagian relevan `design-taste-frontend`. Identitas Arshaka, Carbon, route dan fitur yang ada dipertahankan. Sidebar menjadi terang dengan delapan tujuan langsung dalam dua kelompok terbuka. Teks isi/kontrol 16px, tabel desktop 15px, keterangan 14px, serta kontrol utama setinggi 48px. Drawer HP memiliki tombol Menu/Tutup menu, Escape, pembatasan fokus, dan pengembalian fokus.

**Alur membaca:** dashboard Team Leader mendahulukan KPI, tindakan pemeriksaan yang jelas, dan tabel seluruh proyek; kedua grafik tetap tersedia melalui disclosure. Ringkasan proyek menyediakan pilihan tabel pekerjaan atau Kurva-S yang tersimpan di URL (`display`, hanya frontend). Tabel membandingkan target/capaian fisik, menampilkan kelompok dengan kontribusi berbobot dari API, dan menyediakan angka enam desimal. Pencarian mempertahankan kelompok induk; daftar pekerjaan juga memiliki filter kelompok. Rincian lama, sumber laporan, grafik periode, riwayat dan unduhan tetap tersedia. Form sumber daya dan target memakai divider/baris yang lebih datar tanpa perubahan penyimpanan atau validasi.

**Berkas utama:** `client/src/readable.scss`, `components/WorkProgressTable.tsx`, `components/ProjectSidebar.tsx`, `App.tsx`, `main.tsx`, `pages/MonitoringViews.tsx`, `Monitoring.tsx`, `Progress.tsx`, `WorkItems.tsx`; pedoman di `docs/design-system.md` dan `docs/ui-ux.md`.

**Batas perubahan:** tidak mengubah backend, kontrak API, database, migration/history, autentikasi, hak role, rumus kemajuan, struktur laporan atau format PDF/Excel. Tidak menambahkan data contoh ke aplikasi. Pengujian memakai fixture dan schema tes terisolasi yang sudah tersedia. Tidak ada perintah migration manual yang perlu dijalankan untuk perubahan UI ini.

**Validasi akhir:**

| Pemeriksaan | Hasil |
| --- | --- |
| `npm.cmd run typecheck` dan `npm.cmd run build` | Lulus. Build terakhir 267 modul, JavaScript 614,83 kB / gzip 175,08 kB. |
| Backend terkompilasi, `node --env-file-if-exists=.env --test --test-concurrency=1 dist/tests/*.test.js` dengan shim Windows | 75/75 lulus, termasuk delapan ekspor, formula, otorisasi dan geometri workbook. |
| Regresi browser lengkap pertama | 55/62 lulus. Dua kegagalan akibat overflow tabel HP; lima akibat helper yang memakai drawer tertutup. |
| Pengulangan acceptance, navigasi dan keterbacaan (18 skenario) | Acceptance dan navigasi tidak lagi gagal; tersisa dua tes keterbacaan karena locator status cocok dengan dua elemen. Locator dipersempit ke status hasil pencarian. |
| Pengulangan final `readability.spec.ts`, backend hasil build | 2/2 lulus, desktop dan HP; `.last-run.json` berstatus `passed`. Menguji URL/refresh/kembali, konteks kelompok, angka API sebelum/sesudah, drawer keyboard, 1440/768/390px, dan simulasi CSS zoom 200%. |
| Pemeriksaan screenshot | Dashboard desktop/HP, ringkasan tabel, form laporan HP, dan grafik diperiksa. Bukti tersimpan di `docs/screenshots/readable-ui/`. |

Seluruh skenario lama divalidasi melalui run lengkap dan pengulangan bagian terdampak; ini bukan klaim 64 tes dijalankan sekaligus dalam satu run terakhir. Aturan CSS lama `overflow-x: visible` pada tabel HP diperbaiki khusus area tabel kemajuan. Dokumen kembali selebar layar, sementara tabel tetap dapat digeser di dalam area tersendiri. Pengujian memakai fixture existing tanpa tambahan fixture bisnis.

**Catatan lingkungan 6 Oktober:** PostgreSQL lokal sempat berhenti (`ECONNREFUSED` port 55432). Cluster existing dinyalakan kembali dengan `npm.cmd run db:local:up`, tanpa reset. Backend pengujian source kemudian tidak siap dalam 30 detik; pengulangan final menggunakan `$env:SIMP_TEST_BUILT='true'` dan shim `NODE_OPTIONS` Windows yang sudah tersedia. Tidak ada perubahan konfigurasi atau kredensial aplikasi.

**Batas validasi:** Sass masih memberi peringatan deprecation internal Carbon dan bundle JavaScript di atas 500 kB. Belum dilakukan sesi langsung bersama pengguna berusia lanjut, audit pembaca layar, atau pemeriksaan zoom browser asli. Hasil otomatis tidak menggantikan uji penggunaan tersebut.

**Langkah berikutnya:** uji bersama pengguna proyek berusia lanjut: memilih proyek, menemukan laporan yang perlu diperiksa, mencari uraian pekerjaan, dan membaca target dibanding capaian. Catat bagian yang masih sulit ditemukan sebelum iterasi berikutnya.

### 6 Oktober 2026 — Ukuran lebih ringkas dan panel informasi terbuka

**Permintaan:** kurangi kesan seperti zoom dan tampilkan informasi utama dalam kontainer terpisah, tanpa menghilangkan dropdown pemilih proyek/periode/versi.

**Implementasi:** lapisan `client/src/readable.scss` yang sudah ada diperbarui: sidebar desktop 240px, teks utama/tabel/input desktop 14px, judul 24px, KPI 24px, kontrol 40px, padding tabel vertikal 10px. HP memakai teks 15px, input 16px, judul/KPI 22px, serta kontrol minimal 44px. Tidak memakai CSS zoom/scale untuk mengecilkan aplikasi.

**Panel:** dashboard menampilkan pusat tindakan, tabel pemantauan, Kurva-S dan capaian per periode dalam panel putih berborder tipis tanpa bayangan. Kedua grafik langsung terlihat, berdampingan mulai 1200px dan ditumpuk pada layar lebih kecil. Aktivitas Administrator, filter tanggal/pembanding, masalah, pekerjaan berjalan dan catatan Engineer menjadi section terbuka. Filter laporan/foto, tenaga kerja/cuaca, grafik dan tabel hasil unduhan juga langsung terlihat. Rincian presisi, metadata, riwayat, perbandingan lanjutan dan pratinjau workbook tetap opsional. Filter di dalam panel tidak diberi container kedua.

**Batas:** perubahan hanya presentasi frontend, locator/pemeriksaan browser, dan dokumentasi. Tidak ada perubahan backend, API, tipe bersama, schema/migration, role, izin, rumus, struktur laporan, format PDF/Excel, atau data aplikasi. Route dan query tetap dipertahankan.

**Validasi:** `npm run typecheck` dan `npm run build` lulus. Regresi browser desktop dan HP mencakup 64 skenario dengan backend hasil build serta schema tes terisolasi. Pemeriksaan keterbacaan menegaskan grafik/filter langsung terlihat, ukuran font desktop/HP sesuai, tidak ada scroll horizontal global, dan angka API tetap sama. Dua kegagalan CSS pada jalannya tes awal telah diperbaiki dan masing-masing lulus saat diulang. Peringatan deprecation Sass dari Carbon dan ukuran bundle JavaScript tetap ada; keduanya tidak menggagalkan build.

### 6 Oktober 2026 — Pemulihan perubahan Cursor yang tidak disengaja

**Temuan:** satu giliran agent Cursor mengubah sembilan berkas frontend: `client/src/components/ui.tsx`, `client/src/pages/Login.tsx`, `client/src/App.tsx`, `client/src/Landing.tsx`, `client/src/main.tsx`, `client/src/readable.scss`, `client/src/redesign.scss`, `client/src/workspace.css`, dan `client/index.html`. Perubahan warna dan tata letak bertentangan dengan pedoman desain. Pemeriksaan browser setelah perubahan gagal pada pembesaran desktop 200% dan tombol **Bersihkan pencarian** di HP karena elemen lain menutupinya.

**Pemulihan:** sembilan berkas disalin dahulu ke `.tmp/cursor-last-agent-backup-20261006`, lalu dipulihkan byte demi byte dari snapshot Cursor yang dibuat sebelum giliran tersebut. Setiap berkas diverifikasi sama dengan snapshot. Tidak ada reset proyek atau database, perubahan migration, maupun pemulihan berkas lain. Hasil build frontend kembali memiliki nama aset yang sama dengan build sebelum perubahan Cursor.

**Validasi setelah pemulihan:** `npm run typecheck` dan `npm run build` lulus. Regresi browser lengkap: 63 dari 64 skenario lulus pada jalannya pertama; satu tes Owner desktop terlambat menampilkan Beranda dalam batas tunggu lima detik, lalu lulus ketika diulang sendiri. Dengan demikian seluruh 64 skenario desktop/HP lulus, termasuk dua pemeriksaan keterbacaan yang sempat gagal setelah Cursor, alur lima role, laporan/persetujuan, rencana, kemajuan, unduhan, dan impor workbook. Tes memakai schema PostgreSQL terisolasi; data aplikasi tidak direset.

### 7 Oktober 2026 — Redesign Beranda Team Leader dari referensi tampilan

**Implementasi:** `/ringkasan` untuk Team Leader disusun sebagai konteks proyek terpilih, empat KPI, daftar tindakan yang langsung menuju pekerjaan terkait, Kurva-S dan grafik per periode, tiga foto terbaru yang dapat diakses, serta tabel seluruh proyek dengan pencarian nama/kode. Proyek terpilih mengikuti parameter URL dan bertahan setelah muat ulang. Grafik dan angka memakai endpoint dashboard serta pemantauan yang sudah ada; foto memakai endpoint galeri yang sudah mengikuti izin akses. Keadaan tanpa rencana atau foto, gagal memuat, dan coba lagi ditampilkan tanpa data contoh. Dashboard empat role lain tetap seperti sebelumnya.

**Keterbacaan:** panel mengikuti lebar ruang dashboard, termasuk pada pembesaran 200%; proyek dan grafik menjadi satu kolom saat ruang sempit, sedangkan KPI menjadi dua kolom. Tautan **Lihat masalah** menuju bagian masalah setelah data proyek selesai dimuat. Tangkapan layar acuan desktop, tablet, dan HP tersimpan di `docs/screenshots/dashboard-team-leader/`.

**Validasi:** `npm.cmd run typecheck` dan `npm.cmd run build` lulus. Regresi browser lengkap pertama menghasilkan 64/66 lulus; satu tes desktop timeout sebelum formulir masuk tampil dan satu tes desktop gagal pada pemeriksaan tombol setelah pengiriman laporan. Keduanya lulus saat diulang sendiri, sedangkan pasangan tes HP-nya lulus dalam run lengkap. Setelah penyesuaian responsif final, tes dashboard baru lulus 2/2 di desktop dan HP (pemilih proyek, URL/muat ulang, angka API, pencarian, tautan masalah, keadaan tanpa foto, dan zoom 200%). Tes keterbacaan lulus 2/2 dan memeriksa 1440px, 768px, 390px, serta tidak ada scroll horizontal global. Build masih memberi peringatan deprecation Sass dari Carbon dan ukuran bundle JavaScript; keduanya sudah ada sebelumnya dan tidak menggagalkan build.

**Batas:** perubahan hanya pada frontend, tes browser, pedoman UI, dan screenshot acuan. Tidak ada perubahan database, migration, API, autentikasi, role, permission, route, perhitungan kemajuan, struktur laporan, atau ekspor. Pengujian memakai schema PostgreSQL terisolasi; data aplikasi tidak direset.

### 8 Oktober 2026 — Penunjuk pekerjaan yang targetnya belum lengkap

**Temuan:** pada form Rencana Awal, satu pekerjaan dapat sudah berjumlah 100% tetapi **Periksa Rencana** menampilkan galat untuk pekerjaan lain. Contoh dari workbook TS: **I.1 Papan Nama Proyek** sudah 100% di Minggu 1, sedangkan **IV.A.8 Pengelasan** belum 100%. Pemeriksaan seluruh pekerjaan sudah benar, tetapi form tetap menampilkan pekerjaan sebelumnya sehingga pesan tampak bertentangan.

**Perbaikan:** jika validasi menemukan target pekerjaan belum tepat 100%, editor kini memilih pekerjaan tersebut, memfokuskan pemilihnya, dan menyebut kode serta nama pekerjaan dalam pesan. Aturan jumlah target 100% untuk setiap pekerjaan, perhitungan, dan penyimpanan rencana tidak diubah. Panduan penggunaan diperjelas di `docs/cara-pakai.md`.

**Validasi:** `npm.cmd run build` lulus termasuk typecheck. Seluruh enam skenario `plans.spec.ts` berjalan; lima lulus pada run pertama, sedangkan tes baru HP gagal karena asumsi urutan pekerjaan dalam fixture. Setelah tes memilih Papan Nama Proyek secara eksplisit, skenario baru lulus di desktop dan HP (2/2), termasuk perpindahan otomatis ke Pengelasan dan kelanjutan ke tahap pemeriksaan. Tes memakai schema PostgreSQL terisolasi; data aplikasi tidak direset.

### 8 Oktober 2026 — Urutan pemilih target sesuai kelompok pekerjaan

**Temuan:** daftar pilihan pekerjaan pada form Jadwal & Target mengikuti urutan ID penyimpanan sehingga 38 item workbook TS tampak acak. Daftar Pekerjaan sudah memakai urutan hierarki induk dan kode numerik.

**Perbaikan:** pemilih target kini menyusun item secara berurutan berdasarkan kelompok induk dan kode, menampilkan nama kelompok sebagai pemisah. Urutan pemeriksaan target ikut jelas, tetapi target tetap terhubung ke ID pekerjaan yang sama. Basis rencana, bobot, API, dan data database tidak diubah.

**Validasi:** `npm.cmd run build` lulus termasuk typecheck. Delapan skenario browser terkait rencana dan impor workbook lulus pada desktop/HP (8/8). Tes impor memeriksa 38 pilihan, urutan kode, label kelompok, dan validasi berpindah dari I.1 ke I.2. Tes rencana yang sudah ada memastikan penerbitan, revisi, dan pembacaan Owner tetap berjalan. Database pengujian memakai schema terisolasi; data aplikasi tidak direset.

### 8 Oktober 2026 — Urutan Rincian angka pada rencana terbit

**Temuan:** setelah Rencana Awal diterbitkan, pemilih **Rincian angka** pada tabel target masih mengikuti urutan item dalam snapshot versi yang tersimpan. Karena snapshot mengikuti urutan ID, pilihan pekerjaan tampil acak meskipun pemilih saat mengisi target sudah berurutan.

**Perbaikan:** pemilih Rincian angka sekarang memakai pengelompokan dan urutan yang sama dengan editor target, termasuk untuk versi yang sudah terbit. Pilihan **Total proyek tertimbang** tetap di paling atas. ID pekerjaan, target, snapshot versi, perhitungan, dan database tidak diubah.

**Validasi:** `npm.cmd run build` lulus termasuk typecheck. Delapan skenario browser rencana dan impor workbook lulus pada desktop/HP (8/8). Tes memeriksa urutan dan label kelompok dari 38 item workbook pada editor dan rincian versi terbit, serta memastikan memilih I.1 membuka volume target pekerjaan tersebut. Tes memakai schema PostgreSQL terisolasi; data aplikasi tidak direset.

### 8 Oktober 2026 — Koreksi target workbook TS dan kalender minggu terversi

**Masalah:** pada proyek `639a75b9-2d0d-4b84-b45f-9487c884919d`, 25 dari 38 target pekerjaan V1 tidak sesuai sheet TS. I.2 Mobilisasi dan Demobilisasi seharusnya 50% pada Minggu 1 dan 50% pada Minggu 22, sedangkan target itu tersimpan pada pekerjaan lain. Urutan pemilih sudah diperbaiki sebelumnya, tetapi editor masih mengaitkan isian dengan posisi array. Workbook memakai minggu Senin–Minggu, berbeda dari minggu V1 yang berupa blok tujuh hari sejak proyek dimulai.

**Perbaikan:** editor menyimpan dan membaca target melalui ID pekerjaan, bukan posisi pilihan. `server/templates/workbook-targets.json` diekstrak dari sheet TS dengan hash workbook yang sama seperti sumber pekerjaan M1. Team Leader dapat melihat 38 target dalam pratinjau, termasuk status berbeda/sama serta target versi sebelumnya berdampingan dengan target TS, lalu menerapkannya ke form setelah identitas, satuan, volume, dan harga pekerjaan cocok. Penerbitan tetap memakai service, validasi 100% per item, izin Team Leader, transaksi, dan audit biasa. Migration baru `010_plan_week_convention.sql` menandai konvensi minggu per versi; semua V1 lama mendapat `PROJECT_START`, versi baru mendapat `MONDAY_SUNDAY`. Jadwal, kurva, nomor minggu laporan, filter, rekap, dan ekspor membaca penanda versi; bulan tidak berubah. Rekap tanggal historis tanpa pilihan versi eksplisit memakai versi yang efektif pada akhir periode tersebut.

**Koreksi data nyata:** migration 010 telah diterapkan normal tanpa reset. V2 `a2582b3f-ef2d-4cb4-a8d5-480e1455981e` bernama **Koreksi target workbook TS** diterbitkan melalui `publishPlan`, berlaku **8 Oktober 2026**. V1 tetap identik sebelum/sesudah penerbitan, dan basis pekerjaan tidak berubah. Semua 38 target V2 sama dengan pratinjau TS dan berjumlah tepat 100% per pekerjaan; 25 target berubah dari V1. Minggu 1 V2 adalah 16–19 Juli dan Minggu 22 adalah 7–12 Desember 2026; total kumulatif akhir 100%. Proyek ini belum memiliki laporan harian saat koreksi, sehingga tidak ada sumber aktual yang perlu dipindah. Pembacaan 7 Oktober memilih V1, sedangkan 8 Oktober memilih V2. Rekap historis Minggu 1 tetap 16–22 Juli jika membaca V1; V2 memakai 16–19 Juli.

**Pemeriksaan angka pekerjaan:** seluruh 38 kode, nama, satuan, volume, dan harga dibandingkan dengan M1. Jumlah harga dan bobot dihitung dengan rumus aplikasi lalu dibandingkan terhadap hasil sel M1; selisih jumlah harga terbesar Rp0,0164 karena volume sumber dibatasi enam desimal, selisih bobot terbesar kurang dari 0,000001 poin persentase. Koreksi rencana tidak menulis ulang volume, harga, nilai, atau bobot.

**Validasi:** `npm.cmd run typecheck` dan `npm.cmd run build` lulus; 77/77 tes backend terkompilasi lulus, termasuk migration, minggu parsial/legacy, laporan, rekap historis, progres, delapan ekspor, dan layout workbook. Regresi browser lengkap pertama 63/68 lulus; dua kegagalan memakai ekspektasi lama tiga minggu dan tiga kegagalan waktu muat. Setelah ekspektasi diperbarui, pengulangan rencana, navigasi, akses role, dan persetujuan lulus 34/34 desktop/HP. Setelah perubahan rekap historis, navigasi/progres/laporan/unduhan lulus 24/24 desktop/HP. Setelah tampilan perbandingan ditambahkan, alur impor/pratinjau/penerbitan TS lulus 2/2. Tes browser memakai schema terisolasi, tanpa reset database aplikasi. `npm.cmd run db:migrate` sempat gagal di loader `tsx` karena `uv_os_get_passwd`/`ENOMEM` Windows; runner hasil build berhasil dan melaporkan 0 migration tersisa. Build hanya memberi peringatan deprecation Sass Carbon dan ukuran bundle yang sudah ada.

**Dokumentasi:** aturan minggu dan contoh koreksi dijelaskan di `docs/Penjelasan-rumus.md`; alur versi, API pratinjau, dan rekap ada di `docs/architecture.md`; panduan penggunaan dan keputusan juga diperbarui. Tahap berikutnya adalah verifikasi langsung oleh Team Leader pada V2 dan pemeriksaan laporan baru yang akan memakai nomor minggu Senin–Minggu.

### 8 Oktober 2026 — Pilihan pekerjaan laporan Inspector berurutan

**Masalah:** pemilih **Pekerjaan** pada formulir Laporan Harian menampilkan 38 item berdasarkan urutan ID dalam snapshot basis rencana. Kode dari kelompok I, II, IV.A, dan IV.B bercampur sehingga Inspector sulit menemukan pekerjaan yang benar.

**Perbaikan:** pemilih memakai satu fungsi pengelompokan yang sama dengan editor/rincian rencana: urutan kelompok dan kode numerik, dengan nama kelompok sebagai pemisah. Pilihan **Catatan kegiatan tanpa pekerjaan** tetap di awal. Nilai setiap opsi tetap ID pekerjaan; server memakai ID itu untuk mengambil kode, nama, satuan, dan memvalidasi volume saat draf disimpan. Respons daftar laporan kini menyertakan baris kelompok dari snapshot Rencana Awal agar label kelompok dapat ditampilkan. Hanya baris ITEM yang dapat dipilih. Rencana, laporan, persetujuan, dan perhitungan tidak berubah.

**Pemeriksaan database utama:** proyek contoh tetap memiliki 45 baris pekerjaan (7 kelompok dan 38 item). Seluruh 38 pasangan kode–ID pada tabel `work_items` cocok dengan snapshot Rencana Awal, dan V2 mempunyai 38 target. Proyek belum memiliki laporan harian sebelum perubahan ini. Tidak diperlukan migration, penulisan ulang ID, atau koreksi data; database aplikasi tidak direset.

**Validasi:** `npm.cmd run build` lulus termasuk typecheck. Tes browser workbook TS di desktop/HP lulus 2/2 setelah memeriksa urutan 38 opsi, kelompoknya, serta penyimpanan draf Inspector pada I.2 Mobilisasi dan Demobilisasi. Tes membuka draf kembali, mengganti pilihan ke IV.A.8 Pengelasan, lalu memeriksa ID, kode, nama, satuan, dan volume yang dibaca dari database uji. Regresi browser rencana dan laporan lulus 10/10 desktop/HP; 20/20 tes backend laporan terkompilasi lulus. Pengujian browser memakai schema PostgreSQL terisolasi. Percobaan pertama tes tambahan gagal karena tes berpindah halaman sebelum login selesai; sesudah tes menunggu Beranda dan batas waktunya disesuaikan, kedua viewport lulus. Tidak ada perubahan data produksi/prototype utama dari pengujian.

**Cara memakai:** Inspector membuka proyek → **Laporan Harian** → **Buat Laporan Harian**. Pada **Pekerjaan 1**, pilih kelompok dan kode yang sesuai. Setelah menyimpan, rincian laporan menampilkan pekerjaan serta satuan yang tersimpan. Panduan `docs/cara-pakai.md` telah diperbarui.
### 8 Oktober 2026 — Persiapan trial demo Supabase/Vercel

Proyek Supabase demo sudah dibuat oleh pengguna. Keputusan data: database demo dimulai kosong; data dan dua berkas foto PostgreSQL lokal tidak dipindahkan atau diubah. Langkah dan batas teknis dicatat di `docs/deploy-demo.md`. Bucket Storage privat belum dibuat. Kode API dan penyimpanan foto belum diadaptasi untuk Vercel/Supabase; belum ada migration yang dijalankan pada proyek Supabase dan belum ada deployment. Tidak ada pengujian deployment pada tahap persiapan ini.

**Lanjutan:** pengguna telah membuat bucket privat. Template `demo.env.example` serta perintah `db:demo:migrate` dan `db:demo:bootstrap` disiapkan khusus untuk database demo baru. Perintah menolak URL database lokal dan hanya menerima host Direct Supabase port 5432; kredensial diletakkan pengguna dalam `.env.demo` yang diabaikan Git. `npm.cmd run typecheck` dan `npm.cmd run build` lulus. Guard CLI hasil build menolak koneksi tanpa `DEMO_DATABASE_URL` sebelum membuka database. Loader `tsx` langsung mengalami `uv_os_get_passwd`/`ENOMEM` di Windows ini, sehingga perintah demo memakai hasil build. Migration/akun pada Supabase belum dijalankan karena connection string belum dikonfigurasi secara privat. API Vercel dan Storage belum siap; belum ada deployment.

### 9 Oktober 2026 — Koneksi migration Supabase demo

Pengguna mengisi URL Direct secara privat di `.env.demo`; pemeriksaan aman memastikan host/port/database cocok tanpa menampilkan URL atau password. `sslmode=require` ditambahkan karena semula tidak ada. Percobaan migration belum mencapai SQL: dalam sandbox koneksi ditolak `EACCES`, sedangkan percobaan dengan akses jaringan mencapai TLS tetapi gagal memverifikasi sertifikat self-signed. Berdasarkan panduan Supabase, CLI demo kini mewajibkan sertifikat CA dari dashboard dan membangun koneksi `verify-full` dengan `sslrootcert`; verifikasi TLS tidak dimatikan. Pengguna masih perlu mengunduh sertifikat ke `data/supabase-ca.crt`. `npm.cmd run typecheck` dan `npm.cmd run build` lulus. Pemeriksaan CLI tanpa berkas CA berhenti sebelum koneksi. Tidak ada migration Supabase yang diterapkan, akun demo belum dibuat, dan database lokal tidak disentuh.

**Lanjutan setelah sertifikat:** `data/supabase-ca.crt` kini ada dan terbaca sebagai X.509. Koneksi Direct dengan verifikasi TLS berhasil mencapai PostgreSQL, tetapi autentikasi ditolak dengan kode `28P01`; migration belum menjalankan SQL. Pengguna perlu memeriksa password database Supabase pada `.env.demo` (termasuk percent-encoding karakter khusus) atau meresetnya melalui Database → Settings. Percobaan tidak diulang lagi agar tidak memicu pembatasan alamat IP akibat kegagalan autentikasi berulang. `BOOTSTRAP_ADMIN_*` tetap kosong sampai migration berhasil.

**Percobaan sesudah pemberitahuan perubahan password:** URL tetap lolos pemeriksaan format, tetapi satu percobaan migration kembali menerima `28P01` sebelum SQL dijalankan. Kemungkinan password baru di Supabase belum tercermin pada `DEMO_DATABASE_URL` lokal atau karakter khususnya belum di-*percent-encode*. Percobaan selanjutnya menunggu pengguna menyimpan ulang `.env.demo`; tidak ada data/tabel Supabase atau database lokal yang diubah.

Untuk mengurangi kesalahan saat memasukkan password, perintah `npm.cmd run db:demo:set-password` ditambahkan. Skrip PowerShell meminta password database tanpa menampilkannya, melakukan percent-encoding otomatis, lalu hanya memperbarui bagian password pada URL `.env.demo`; sintaks skrip telah diperiksa. Perintah belum dijalankan karena password tetap di tangan pengguna.

**Pemeriksaan setelah pembaruan password berikutnya:** format URL Direct tetap valid dan satu percobaan `db:demo:migrate` kembali ditolak PostgreSQL dengan `28P01`. Koneksi jaringan dan TLS sudah berhasil; pemeriksaan lokal memastikan username Direct `postgres`, password di URL terbaca utuh oleh driver, dan tidak ada variabel proses yang menimpa `DEMO_DATABASE_URL`. Pengodean karakter khusus diuji memakai password contoh. Tidak ada SQL migration yang dijalankan. Percobaan autentikasi dihentikan sementara; pengguna perlu memastikan password pada `.env.demo` adalah password **Database** proyek Supabase yang sama, bukan password akun Supabase, kemudian menjalankan pembaruan aman dan mencoba sekali lagi. Database lokal tetap tidak disentuh.

**Sesudah password di-*percent-encode*:** pemeriksaan format URL tetap lulus. Satu percobaan migration berhenti pada batas waktu koneksi sebelum autentikasi, tanpa menjalankan SQL. Pemeriksaan jaringan tanpa password menunjukkan DNS mengembalikan alamat IPv6 untuk host Direct Supabase, tetapi TCP port 5432 tidak tersambung dalam 4 detik. Skrip aman `scripts/check-demo-network.mjs` ditambahkan untuk mengulang pemeriksaan jaringan tanpa login. Belum dapat disimpulkan apakah password baru benar sampai jaringan Direct kembali tersambung. Tidak ada migration atau bootstrap di Supabase; database lokal tidak disentuh.

**Sesudah perubahan password terakhir:** pemeriksaan aman masih menunjukkan URL Direct valid, tetapi TCP ke alamat IPv6 Supabase tetap *timeout* sebelum login. Untuk jaringan yang hanya dapat menjangkau IPv4, CLI demo kini menyediakan opsi `DEMO_DB_SESSION_HOST`: hostname **Session pooler** dari Supabase Connect, port 5432, username dibentuk dari project ref Direct, password tetap dari `.env.demo`, dan TLS tetap `verify-full` memakai CA. Opsi belum aktif sampai pengguna mengisi host yang benar; tidak ada percobaan login tambahan. `npm.cmd run typecheck` dan `npm.cmd run build` lulus. Migration dan bootstrap demo masih tertunda; data lokal tidak berubah.

**Sesudah host Session pooler diisi:** format URL/host valid, DNS pooler memberi IPv4 dan TCP port 5432 tersambung. Dua percobaan migration yang dibatasi (dengan jeda untuk cache kredensial pooler) sama-sama ditolak PostgreSQL dengan `28P01` sebelum SQL. Pemeriksaan lokal tidak menemukan pola `@` yang ter-encode dua kali; nilai URL yang dibaca Node identik dengan `.env.demo`. Percobaan login dihentikan. Perlu memastikan password **Database** dan hostname Session pooler berasal dari proyek Supabase yang sama, lalu memperbarui password URL dengan helper aman; database Supabase belum dimigrasi, administrator demo belum dibuat, database lokal tidak disentuh.

**Migration Supabase demo berhasil:** setelah kredensial database dimasukkan melalui prompt tersembunyi, `npm.cmd run db:demo:migrate` menerapkan 10 migration pada database demo kosong melalui Session pooler IPv4. Pemeriksaan kedua menjalankan perintah yang sama dan menghasilkan 0 migration baru, sehingga riwayat serta checksum migration konsisten. `npm.cmd run db:demo:set-password` kini memakai `-ExecutionPolicy Bypass` hanya pada proses PowerShell pemanggil karena kebijakan eksekusi lokal sebelumnya memblokir skrip. Tidak ada password dicatat di dokumentasi atau log perintah. Administrator demo belum dibuat karena `BOOTSTRAP_ADMIN_*` belum diisi. Adaptasi API Vercel dan foto Supabase Storage tetap belum selesai; database lokal tidak disentuh.

**Administrator demo dibuat:** setelah pengguna mengisi `BOOTSTRAP_ADMIN_*` secara privat, `npm.cmd run db:demo:bootstrap` berhasil membuat Administrator pada database Supabase demo. Pemeriksaan kedua menghasilkan `Administrator demo sudah ada; data tidak diubah` dan 0 migration baru. Ketiga isian bootstrap kemudian dikosongkan dari `.env.demo` dengan skrip aman `scripts/clear-demo-bootstrap.mjs`; akun tetap berada di database. Tidak ada kredensial dicatat dalam log atau dokumentasi. API Vercel, foto Storage, dan deployment masih pekerjaan berikutnya.

**Arti database kosong dikonfirmasi:** pengguna menghendaki tabel SIMP dan akun Administrator tetap ada, tetapi belum ada proyek/laporan demo. Perintah baca-saja `npm.cmd run db:demo:inspect` ditambahkan dan dijalankan pada Supabase demo: 10 migration, 1 akun, **0 proyek, 0 laporan, 0 foto**. Tidak ada data yang dihapus atau ditambah dalam pemeriksaan ini. `npm.cmd run build` lulus termasuk typecheck.

**Pemeriksaan kesiapan Vercel:** frontend Vite menghasilkan `dist/client` dan memanggil `/api` pada origin yang sama, tetapi repository belum memiliki entrypoint Vercel Function atau `vercel.json`. `server/index.ts` masih menjalankan migration dan membuka port pada startup; foto tetap memakai disk lokal. Batas body Vercel Function 4,5 MB lebih kecil dari unggahan foto SIMP 5 MiB sebelum base64, sehingga deployment langsung akan mematahkan alur foto. Pengaturan dashboard dan urutan validasi telah ditulis di `docs/deploy-demo.md`; belum ada deployment atau perubahan data. Langkah kode berikutnya ialah adapter API, koneksi pooler untuk Functions, unggah privat Supabase Storage yang menangani batas payload, dan pengujian seluruh alur sebelum URL dibagikan.

**Konfigurasi kode Vercel disiapkan:** `api/index.ts` menjalankan Fastify sebagai Vercel Function tanpa membuka port atau menjalankan migration pada startup. `vercel.json` mengarahkan `/api/*` ke Function dan route aplikasi ke frontend Vite, sambil memasukkan template workbook untuk ekspor. Pool PostgreSQL dibatasi satu koneksi per Function; `DATABASE_CA_BASE64` memverifikasi TLS ke Transaction pooler Supabase. Foto memakai bucket Storage privat pada Vercel dan tetap memakai berkas lokal pada mode pengembangan. Secret Storage hanya dikirim dari server; foto besar diperkecil sebelum dikirim agar request berada di bawah batas body Function. Contoh Environment Variables ada di `vercel.env.example`, dan langkah setup ada di `docs/deploy-demo.md`. Database, migration, izin, rumus, dan format ekspor tidak diubah.

**Validasi sebelum deployment:** `npm.cmd run build` lulus termasuk typecheck; 79/79 tes backend terkompilasi lulus. Dua tes penyimpanan foto lokal/Storage mock lulus. Koneksi Transaction pooler Supabase demo berhasil diuji dengan query baca-saja dan CA. Adapter API lokal dengan konfigurasi demo menghasilkan 200 untuk `/api/health`, 200 untuk path hasil rewrite, dan 401 untuk `/api/auth/me` tanpa sesi. Empat skenario browser laporan desktop/HP lulus, termasuk unggah dan pembacaan foto; dua skenario tambahan desktop/HP memeriksa foto sumber berukuran lebih dari 2,8 MiB setelah kompresi dan pembacaan ulang. Tes backend dan browser memakai database lokal serta schema uji terisolasi; tidak ada reset atau perubahan data demo. PostgreSQL lokal yang dipakai untuk tes sudah dihentikan tanpa menghapus datanya. **Deployment Vercel dan akses bucket Supabase nyata belum diuji**, sehingga statusnya siap dikonfigurasi di akun Vercel, belum live.

**Diagnosis build Vercel pertama:** Vercel mengambil commit `610621a` dari `main`, yang hanya berisi `README.md`. Semua berkas aplikasi, termasuk `package.json`, `package-lock.json`, dan `vercel.json`, masih berada di workspace lokal dan belum ada pada commit itu. Karena itu Vercel menjalankan perintah Vite tanpa dependensi terpasang lalu gagal `vite: command not found`. Perbaikan adalah menyiapkan commit kode aplikasi yang sudah tervalidasi, kemudian mengirim commit tersebut ke `main` agar Vercel membangun source yang benar. Tidak diperlukan perubahan database atau kunci Supabase.

**Diagnosis Function Vercel berikutnya:** setelah kode aplikasi terkirim, frontend dapat dimuat tetapi `/api/health` gagal 500. Function Logs menunjukkan `ERR_REQUIRE_ESM` saat `@fastify/static` mencoba memuat `content-disposition`; error terjadi ketika modul API dibuka, sebelum koneksi database. Registrasi static frontend dipindah ke modul yang hanya diimpor oleh server mandiri. API Vercel tetap memakai `buildApp` tanpa memuat `@fastify/static`. Build lulus, adapter lokal dengan Supabase demo menghasilkan health 200 dan `auth/me` 401 tanpa sesi, dan server mandiri masih menyajikan `/` serta route SPA dengan 200. Status URL Vercel sesudah deployment akan diverifikasi terpisah.

**Hasil deployment perbaikan awal:** commit `522cb4e` membuat respons `/api/health` berubah dari `FUNCTION_INVOCATION_FAILED` 500 menjadi respons JSON 503 dari adapter aplikasi. Ini memastikan crash saat import telah hilang, tetapi inisialisasi API masih gagal. Adapter menambahkan log diagnostik aman berisi tahap (`configuration`, `storage`, `database`, atau `routes`), jenis, dan kode error tanpa mencatat nilai Environment Variables. Diagnosis penyebab 503 berikutnya menunggu Function Logs dari deployment ini.

**Log Function berikutnya:** domain utama `simp-eight.vercel.app` menunjukkan kegagalan pada tahap `configuration`; respons 500 `ERR_REQUIRE_ESM` dalam ekspor log berasal dari URL preview deployment lama. Log konfigurasi kini juga akan mencatat nama field yang gagal validasi, tanpa nilainya, agar Environment Variable Vercel yang perlu diperbaiki dapat diidentifikasi.
