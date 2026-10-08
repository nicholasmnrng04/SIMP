# Panduan Menjalankan dan Menggunakan SIMP

SIMP adalah **Sistem Informasi Monitoring Proyek**. Aplikasi ini membantu menyimpan informasi proyek, membagi tugas anggota, menyusun pekerjaan, dan membuat rencana pelaksanaan.

Panduan ini untuk menjalankan aplikasi di **komputer Windows sendiri**. Perintah di bawah diketik pada terminal **PowerShell** di VS Code. Terminal adalah tempat untuk memberi perintah kepada komputer melalui tulisan.

Aplikasi masih berupa **prototype**, yaitu versi yang sedang dikembangkan dan dicoba. Tahap T00–T11 telah selesai. Saat ini, fitur akun, proyek, tim, pekerjaan, bobot, rencana, laporan harian, foto, pemeriksaan, persetujuan, koreksi dan progress aktual sudah tersedia. Laporan mingguan/bulanan juga tersedia. Ringkasan, grafik, galeri berfilter dan riwayat juga tersedia; unduhan PDF/Excel tersedia melalui Laporan dan Rekap. Navigasi terbaru dijelaskan dalam [panduan UI](ui-ux.md).

## 1. Mengenal bagian aplikasi

Bayangkan SIMP seperti kantor proyek yang memiliki meja pelayanan, petugas pengolah data, dan lemari arsip.

| Bagian | Teknologi yang digunakan | Penjelasan sederhana | Alasan digunakan dalam proyek ini |
| --- | --- | --- | --- |
| Frontend, yaitu tampilan aplikasi | **React 19** | Seperti meja pelayanan: tempat melihat halaman, mengisi formulir, dan menekan tombol. | Bagian tampilan, seperti formulir dan tombol, dapat dipakai kembali. Ini membantu menjaga tampilan tetap seragam saat fitur bertambah. |
| Alat menjalankan dan menyiapkan frontend | **Vite 8** | Membantu menampilkan hasil perubahan halaman selama aplikasi dikembangkan, lalu menyiapkan berkas untuk dijalankan sebagai hasil build. | Memudahkan proses mencoba dan memperbaiki tampilan. |
| Backend, yaitu pengolah permintaan | **Node.js 24 dan Fastify 5** | Seperti petugas kantor: memeriksa siapa yang masuk, apakah boleh mengubah data, lalu memproses permintaan. | Aturan dan pemeriksaan data dapat diletakkan di satu tempat yang juga dipakai berbagai halaman. |
| Database, yaitu tempat penyimpanan data | **PostgreSQL 17** | Seperti lemari arsip: menyimpan akun, proyek, pekerjaan, rencana, dan riwayat perubahan. | Data saling berhubungan. PostgreSQL membantu menjaga hubungan tersebut dan menyimpan beberapa perubahan sebagai satu kesatuan: semuanya berhasil, atau semuanya dibatalkan. |
| Bahasa pemrograman | **TypeScript** | Membantu pengembang memeriksa bentuk data, misalnya membedakan angka dengan tulisan. | Sejumlah kesalahan dapat diketahui sebelum aplikasi dijalankan. |

Contoh saat Anda menekan **Simpan Pekerjaan**: React mengirim isian ke backend. Backend memeriksa isian dan hak akses, lalu menyimpannya di PostgreSQL. Hasilnya dikirim kembali untuk ditampilkan pada halaman.

**Data yang sudah disimpan berada di database, sehingga tetap ada setelah aplikasi ditutup dan dinyalakan kembali.** Isian formulir yang belum disimpan atau rencana yang belum diterbitkan belum menjadi data tersimpan.

PostgreSQL adalah database yang digunakan sekarang. Berkas SQLite lama hanya merupakan arsip dan tidak digunakan aplikasi. Excel juga bukan tempat penyimpanan utama aplikasi.

## 2. Aplikasi berjalan di mana?

Dalam pengaturan lokal ini, ketiga bagian berjalan di komputer yang sama.

| Bagian | Alamat bawaan | Kegunaan |
| --- | --- | --- |
| Frontend saat pengembangan | `http://127.0.0.1:5173` | **Alamat yang dibuka di browser untuk memakai aplikasi.** |
| Backend | `http://127.0.0.1:3001` | Menerima dan memproses permintaan dari halaman aplikasi. |
| PostgreSQL | `127.0.0.1:55432` | Tempat backend terhubung ke database. Ini bukan alamat halaman web. |

`127.0.0.1` berarti **komputer yang sedang Anda gunakan**. Angka di belakang tanda titik dua disebut *port*. Bayangkan port seperti nomor pintu untuk membedakan layanan pada komputer tersebut.

Nama database lokal adalah **`simp`**. Akun yang dipakai aplikasi untuk terhubung ke database adalah **`simp_app`**. Akun database ini berbeda dari akun Administrator yang dipakai masuk ke halaman SIMP.

Pengaturan bawaan hanya melayani komputer sendiri. Membuka `127.0.0.1` di HP akan menunjuk HP tersebut, sehingga tidak otomatis membuka aplikasi di komputer. Akses dari perangkat lain memerlukan pengaturan jaringan tersendiri.

## 3. Persiapan pertama kali

Jika aplikasi sebelumnya sudah berhasil dijalankan di komputer ini, langsung menuju **bagian 4**.

### A. Pastikan perangkat lunak tersedia

Yang diperlukan:

- **Node.js seri 24**, minimal versi 24.15, dan **npm seri 11**. Keduanya digunakan untuk menjalankan kode serta memasang kebutuhan aplikasi.
- **PostgreSQL 17**, untuk menyimpan data.
- Browser, misalnya Microsoft Edge atau Chrome.
- VS Code untuk membuka folder proyek dan terminal pada panduan ini.

Untuk memeriksa Node.js dan npm, buka menu **Terminal → New Terminal** di VS Code, lalu jalankan satu per satu:

```powershell
node --version
npm.cmd --version
```

Versi yang pernah diuji pada proyek ini adalah Node.js **24.19.0**, npm **11.17.0**, dan PostgreSQL **17.11**. Ini adalah catatan versi pengujian, bukan petunjuk untuk selalu memasang versi paling baru.

### B. Buka folder aplikasi

Di VS Code, pilih **File → Open Folder**, lalu buka folder proyek. Pada komputer workspace ini, lokasinya:

```text
C:\Users\User\Documents\final
```

Jika terminal belum berada di folder tersebut, jalankan:

```powershell
cd "C:\Users\User\Documents\final"
```

Sesuaikan lokasi jika folder Anda berbeda. Semua perintah berikut dijalankan dari folder yang berisi **`package.json`**, bukan dari folder `docs`.

### C. Pasang kebutuhan aplikasi

```powershell
npm.cmd ci
```

Perintah ini memasang paket yang diperlukan sesuai daftar versi proyek. Tunggu sampai selesai. Koneksi internet diperlukan jika paket belum tersedia di komputer. Tidak perlu mengulangnya setiap kali membuka aplikasi; jalankan lagi bila dependensi proyek berubah atau diminta pengembang.

### D. Siapkan database lokal

```powershell
npm.cmd run db:local:up
npm.cmd run db:migrate
```

Jalankan baris pertama sampai selesai, baru baris berikutnya.

- **`db:local:up`** menyiapkan database lokal jika belum ada, lalu menyalakannya. Data disimpan dalam folder `data/postgres` milik proyek ini. Layanan PostgreSQL lain di komputer tidak diubah.
- **`db:migrate`** menyiapkan atau memperbarui susunan tabel penyimpanan sesuai versi aplikasi. Perintah ini bukan perintah untuk mengosongkan data. Pesan **0 migration baru** berarti tidak ada pembaruan tabel yang perlu diterapkan.

Helper lokal mencari PostgreSQL di `C:\Program Files\PostgreSQL\17\bin`. Jika instalasi berada di tempat lain, atur lokasinya di terminal sebelum menjalankan `db:local:up`:

```powershell
$env:PG_BIN = "D:\LokasiPostgreSQL\17\bin"
```

Ganti contoh tersebut dengan lokasi folder `bin` yang benar. Pengaturan ini berlaku pada terminal tersebut.

Pada persiapan lokal yang benar-benar baru, helper membuat berkas **`.env`** berisi pengaturan koneksi dan kata sandi database acak. Anda tidak perlu menyalin `.env.example` terlebih dahulu untuk jalur setup lokal ini. Jika `.env` sudah ada, helper tidak menimpanya.

Jika helper berhenti karena `.env` atau folder data sudah ada tetapi pengaturan lokal belum cocok, jangan menghapusnya untuk memaksa setup. Periksa pengaturan bersama pengembang; berkas tersebut mungkin merujuk database yang sudah digunakan.

### E. Buat akun Administrator pertama

Tidak ada email atau kata sandi masuk bawaan. Buka berkas **`.env`** di folder utama, lalu isi nilai setelah tanda `=` pada tiga pengaturan berikut:

| Pengaturan | Diisi dengan |
| --- | --- |
| `BOOTSTRAP_ADMIN_NAME` | Nama orang yang menjadi Administrator. |
| `BOOTSTRAP_ADMIN_EMAIL` | Alamat email untuk masuk ke aplikasi. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Kata sandi pilihan Anda, sepanjang 12–128 karakter. |

Simpan berkas, lalu jalankan:

```powershell
npm.cmd run db:bootstrap
```

Tunggu pesan **Administrator berhasil dibuat**. Jika Administrator aktif dengan email yang sama sudah ada, perintah tidak mengganti akun atau kata sandinya.

Setelah berhasil, kosongkan kembali nilai ketiga pengaturan bootstrap di `.env`, lalu simpan. Akun yang sudah dibuat tetap ada di database. Simpan email dan kata sandi Anda secara pribadi.

**Jangan membagikan `.env` atau `data/postgres-local.json`**, karena berisi informasi koneksi dan kata sandi. `.env.example` adalah contoh pengaturan, sedangkan `.env` adalah pengaturan pribadi yang benar-benar dipakai aplikasi.

## 4. Menyalakan aplikasi sehari-hari

Buka terminal di folder proyek, lalu jalankan:

```powershell
npm.cmd run db:local:up
npm.cmd run dev
```

Perintah pertama memastikan database menyala. Perintah kedua menjalankan **frontend dan backend sekaligus**, jadi tidak perlu menyalakan keduanya melalui terminal terpisah.

Biarkan terminal tetap terbuka. Setelah layanan siap, buka browser pada:

**http://127.0.0.1:5173/masuk**

Masuk memakai email dan kata sandi akun aplikasi Anda. Jangan memakai nama akun database `simp_app` untuk masuk ke halaman ini.

Ketika Anda mengubah kode, layanan pengembangan dapat memuat ulang secara otomatis. Pesan seperti **Restarting server/index.ts** lalu **Server listening at http://127.0.0.1:3001** berarti backend dimulai kembali dan sudah menerima koneksi. Periksa pesan kesalahan jika sesudahnya halaman tetap tidak bisa digunakan.

## 5. Urutan mencoba fitur yang tersedia

### A. Buat akun anggota

Masuk sebagai **Administrator**, buka **Pengguna**, lalu buat akun sesuai tugasnya.

| Peran | Yang dapat dilakukan pada fitur saat ini |
| --- | --- |
| Administrator | Mengelola akun, proyek, tim dan pekerjaan; membaca rencana. |
| Team Leader atau TL | Mengelola proyek/pekerjaan sesuai akses, mengatur Engineer/Inspector, menerbitkan rencana, membuat laporan sendiri, membaca laporan tim, serta menyetujui atau meminta perbaikan laporan. |
| Owner | Membaca proyek, tim, pekerjaan dan rencana yang ditugaskan, serta laporan/foto yang sudah disetujui. |
| Engineer | Membaca proyek, tim, pekerjaan, rencana serta laporan/foto dalam proyek yang ditugaskan. Memberi catatan pemeriksaan teknis pada laporan yang menunggu pemeriksaan. |
| Inspector | Membaca proyek/pekerjaan/rencana yang ditugaskan serta membuat, mengubah draf, mengunggah foto dan mengirim laporan miliknya. |

Selain Administrator, seseorang perlu mendapat penugasan aktif pada proyek agar dapat melihatnya. Memiliki akun saja belum otomatis memberi akses ke semua proyek.

### B. Buat proyek dan atur tim

1. Masuk sebagai Administrator atau TL.
2. Buka **Proyek → Tambah Proyek**.
3. Isi informasi proyek, kontrak, dan jadwal, lalu simpan.
4. Buka **Tim & Informasi → Tim** untuk mengatur anggota dan periode penugasannya. Administrator menetapkan TL dan Owner; TL dapat mengatur Engineer dan Inspector.

Saat mengisi nominal, jangan gunakan pemisah ribuan. Misalnya, satu juta rupiah ditulis **`1000000`**. Pecahan dapat memakai koma pada form, misalnya **`1000000,50`**.

### C. Susun daftar pekerjaan

1. Pilih proyek → **Rencana Pekerjaan → Daftar pekerjaan**.
2. Gunakan **Tambah Kelompok** untuk membuat pengelompokan, misalnya “Pekerjaan Struktur”.
3. Gunakan **Tambah Pekerjaan** untuk isi kelompok, misalnya “Pengecoran Beton”. Isi satuan, volume dan harga satuan.
4. Setelah disimpan, nilai dan bobot dihitung otomatis.

Contoh: volume **10** dengan harga satuan **Rp100.000** menghasilkan nilai **Rp1.000.000**. Bobot menunjukkan bagian nilai pekerjaan tersebut terhadap total nilai semua item. Kelompok hanya merangkum pekerjaan di dalamnya, sehingga nilainya tidak dihitung dua kali.

### D. Buat Rencana Awal

1. Masuk sebagai **TL yang ditugaskan pada proyek**.
2. Pilih proyek → **Rencana Pekerjaan → Jadwal & target → Buat Rencana Awal**.
3. Pilih sumber target mingguan atau bulanan.
4. Pilih setiap pekerjaan dan isi tambahan target tiap periode sampai jumlahnya **100% per pekerjaan**. Contoh dua minggu: 40% pada minggu pertama dan 60% pada minggu kedua.
5. Periksa isian, lalu pilih **Tetapkan Rencana**.

Pemilih **Pekerjaan yang diatur** menampilkan item berurutan menurut kelompok dan kode pekerjaan, sama seperti Daftar Pekerjaan. Judul kelompok membantu mencari item, sedangkan nilai target yang sudah diisi tetap melekat pada pekerjaan yang dipilih.

Sesudah rencana ditetapkan, pemilih **Rincian angka** pada tabel target memakai urutan kelompok yang sama. Pilih **Total proyek tertimbang** untuk membaca target seluruh proyek, atau pilih satu pekerjaan untuk membaca target dan volume pekerjaan tersebut.

Jika **Periksa Rencana** menampilkan pesan dengan kode pekerjaan lain, pekerjaan yang belum tepat 100% itu otomatis dipilih. Contohnya, Papan Nama Proyek dapat sudah 100%, tetapi pesan **IV.A.8 · Pengelasan** berarti target Pengelasan masih perlu diisi. Pekerjaan yang selesai pada satu minggu dapat diisi 100% pada minggu itu dan 0% pada minggu lain.

Pada rencana baru, minggu pertama dimulai dari tanggal mulai proyek dan berakhir pada hari Minggu. Contohnya, proyek mulai Kamis 16 Juli 2026: minggu pertama adalah **16–19 Juli**, minggu berikutnya **20–26 Juli**. Rencana yang terbit sebelum perubahan ini tetap memakai hitungan tujuh hari sejak tanggal mulai. Bulan pertama tetap **16 Juli–15 Agustus**, kecuali proyek selesai lebih awal. Jika pekerjaan berasal dari workbook TS yang cocok, Team Leader dapat memilih **Pratinjau target dari workbook TS**, memeriksa status dan target versi sebelumnya berdampingan dengan 38 target TS, lalu menekan **Gunakan target workbook TS** sebelum menetapkan versi. Jika aturan minggu versi lama berbeda, perhatikan rentang tanggalnya saat membandingkan.

Penerbitan Rencana Awal mengunci dasar perhitungan seperti volume, harga, satuan dan struktur pekerjaan. Karena itu, periksa daftar pekerjaan sebelum menerbitkan. Form rencana belum memiliki penyimpanan otomatis; isian yang belum diterbitkan dapat hilang jika halaman ditutup atau dimuat ulang.

### E. Buat perubahan rencana

Gunakan **Buat Perubahan Rencana**, isi alasan dan tanggal berlaku, atur target atau tanggal selesai yang baru, lalu terbitkan. Rencana lama tetap tersedia untuk diperiksa dan dibandingkan.

Tanggal berlaku revisi harus setelah versi terakhir dan tidak sebelum hari ini. Revisi yang berlaku besok belum menjadi rencana yang berlaku hari ini. Gunakan pilihan **Tanggal pemeriksaan** untuk melihat rencana mana yang berlaku pada tanggal tertentu.

### F. Isi laporan harian dan unggah foto

1. Masuk sebagai **Inspector atau TL** yang mendapat penugasan aktif. Proyek harus sudah memiliki Rencana Awal yang diterbitkan.
2. Pilih proyek → **Laporan → Harian → Buat Laporan Harian**.
3. Isi tanggal dan uraian kegiatan. Pilihan pekerjaan diurutkan menurut kelompok dan kode seperti pada **Daftar Pekerjaan**; pilih item yang tepat bila mencatat volume. Satuannya mengikuti item tersebut. Untuk kegiatan naratif, volume boleh kosong. Contohnya, “Rapat persiapan lapangan” tidak memerlukan volume.
4. Klik **Lanjut** untuk mengisi tenaga kerja dan cuaca, lalu material/alat dan masalah, kemudian catatan umum. Material yang ditolak wajib memiliki alasan. Cuaca malam boleh kosong bila tidak ada kegiatan malam.
5. Pada langkah terakhir, klik **Simpan & Lanjut ke Foto**. Pada langkah sebelumnya, **Simpan Sementara** juga tersedia. Nomor laporan dan hitungan hari/minggu muncul otomatis. Draf dapat dibuka dan diedit lagi oleh pembuatnya. Hanya satu laporan per orang, proyek dan tanggal.
6. Pada detail laporan, tekan **Lengkapi Foto**, pilih berkas foto, kegiatan terkait, dan isi keterangan. Lokasi boleh ditambahkan. Klik **Unggah Foto**. Gunakan JPEG atau PNG maksimal **5 MiB** (sekitar 5 MB), maksimal 20 juta piksel dan 20 foto per laporan. Tanggal foto mengikuti tanggal laporan.
7. Setiap kegiatan dengan volume lebih dari nol wajib memiliki minimal satu foto sebelum dikirim. Foto juga bisa dibuka melalui **Daftar Pekerjaan → Dokumentasi [kode pekerjaan]**.
8. Pilih **Periksa Sebelum Kirim**, baca kembali seluruh rincian dan foto, lalu **Kirim untuk Diperiksa**.

Status berubah dari **Belum Dikirim** menjadi **Menunggu Pemeriksaan**. Setelah dikirim, laporan dan fotonya tidak dapat diubah atau dihapus melalui edit biasa. TL memeriksanya melalui langkah berikut. Laporan yang baru dikirim belum menjadi sumber progress resmi.

Tanggal laporan tidak boleh melewati hari ini dan harus masuk jadwal rencana yang berlaku pada tanggal tersebut. Tanggal material dan masalah sama dengan tanggal laporan. Jika ada isian pecahan pada jumlah material atau jam kerja, gunakan titik, misalnya `7.5`; volume kegiatan menerima koma atau titik. Jam cuaca dicatat dalam satu tanggal, sehingga waktu setelah tengah malam masuk laporan hari berikutnya.

Foto hanya dapat dibuka oleh orang yang berhak membaca laporan. Inspector lain tidak dapat mengubah atau membuka laporan Anda. Owner belum dapat melihat laporan yang masih draf atau menunggu pemeriksaan. Bila perlu mengganti tanggal atau kegiatan yang sudah memiliki foto, hapus foto terkait terlebih dahulu.

Isian tidak tersimpan otomatis. Tekan **Simpan Sementara** sebelum meninggalkan halaman. Berkas foto berada di folder unggahan aplikasi, sedangkan rinciannya ada di database; pencadangan data perlu menyertakan keduanya.

### G. Memeriksa, menyetujui, dan memperbaiki laporan

Bayangkan laporan seperti lembar catatan yang diserahkan kepada pemeriksa. Selama masih diperiksa, isinya dikunci agar kedua pihak membaca catatan yang sama.

1. Pilih proyek → **Laporan → Harian**. Untuk Engineer dan Team Leader, daftar awal menampilkan laporan menunggu pemeriksaan. Tekan **Semua laporan** untuk melihat daftar lainnya.
2. **Engineer** dapat membuka laporan dan menulis **Catatan pemeriksaan teknis**. Tekan **Simpan Catatan Engineer**. Catatan ini membantu TL menilai laporan.
3. **Team Leader (TL)** membaca laporan, foto, dan catatan Engineer. Pilih **Setujui Laporan** jika sesuai, atau **Minta Perbaikan** bila ada yang perlu dibetulkan. Permintaan perbaikan wajib disertai alasan.
4. Jika statusnya **Perlu Diperbaiki**, pembuat laporan membuka **Ubah Laporan**, membetulkan isian/foto, menyimpan, lalu mengirimnya kembali.
5. Jika statusnya **Sudah Disetujui**, Owner dapat melihat laporan dan fotonya. Kegiatan yang memiliki volume menjadi sumber angka pada halaman **Rincian kemajuan**.

Hanya TL yang sedang ditugaskan pada proyek tersebut dapat menyetujui laporan. Administrator mengelola aplikasi dan akun, tetapi tidak mengambil keputusan teknis. Jika muncul pesan laporan sudah berubah, muat ulang halaman dan baca keadaan terbaru sebelum mencoba lagi.

### H. Mengoreksi laporan yang sudah disetujui

Laporan yang sudah disetujui disimpan seperti arsip. Jika ditemukan kesalahan, buat lembar koreksi agar catatan lama tetap bisa dilihat.

1. Masuk sebagai pembuat laporan yang masih bertugas pada proyek, lalu buka laporan berlabel **Sumber resmi yang berlaku**.
2. Isi **Alasan koreksi**, lalu tekan **Buat Koreksi**. Aplikasi membuat versi baru dan menyalin isian serta fotonya.
3. Tekan **Ubah Laporan**, betulkan data, simpan, lalu kirim kembali untuk diperiksa TL. Foto versi lama tetap tersimpan meskipun foto pada koreksi diganti.
4. Selama koreksi belum disetujui, versi lama tetap berlaku dan Owner belum melihat koreksi. Setelah disetujui, versi baru menggantikan versi lama sebagai sumber resmi.
5. Gunakan tautan **Versi laporan** untuk membuka arsip sebelumnya. Label menunjukkan versi yang masih berlaku dan versi yang sudah digantikan.

Nomor, tanggal dan pembuat laporan tetap sama; nomor versinya bertambah. Selesaikan satu koreksi sebelum membuat koreksi berikutnya. Koreksi dan laporan yang pernah diperiksa tidak dapat dihapus. Jumlah volume seluruh laporan sah tidak boleh melebihi volume kontrak; bila ditolak saat kirim atau persetujuan, periksa kembali hasil ukur.

## 6. Menutup aplikasi dan menyalakannya kembali

Untuk berhenti:

1. Selesaikan penyimpanan data yang sedang diisi.
2. Pada terminal yang menjalankan `npm.cmd run dev`, tekan **Ctrl+C**. Jika muncul pertanyaan konfirmasi dari terminal, ikuti petunjuknya.
3. Untuk mematikan database lokal juga, jalankan:

```powershell
npm.cmd run db:local:down
```

Perintah tersebut mematikan layanan database **tanpa menghapus data**. Setelah komputer dinyalakan kembali, ulangi langkah pada bagian 4. Tidak perlu membuat ulang akun atau proyek.

## 7. Menjalankan hasil build untuk demo lokal

*Build* adalah proses menyiapkan berkas aplikasi agar dapat dijalankan tanpa server pengembangan frontend terpisah.

Hentikan `npm.cmd run dev` terlebih dahulu, lalu jalankan berurutan:

```powershell
npm.cmd run db:local:up
npm.cmd run build
npm.cmd start
```

Jika build berhasil dan server siap, buka **http://127.0.0.1:3001/masuk**. Dalam cara ini, frontend dan backend disajikan melalui alamat yang sama. PostgreSQL tetap berjalan di port **55432**.

Perbedaannya mudah diingat: **`dev` → buka 5173**, sedangkan **hasil build dengan `start` → buka 3001**. Jika kode berubah, lakukan build lagi sebelum menjalankan hasil terbaru. Cara ini masih untuk demo lokal, bukan penyiapan layanan production.

## 8. Jika ada kendala

| Kendala | Yang dapat diperiksa |
| --- | --- |
| `node` atau `npm.cmd` tidak dikenali | Pastikan Node.js/npm terpasang, lalu tutup dan buka kembali terminal atau VS Code. |
| Perintah tidak menemukan `package.json` | Pastikan terminal berada di folder utama proyek, bukan `docs` atau folder lain. |
| PostgreSQL tidak ditemukan | Periksa lokasi instalasi PostgreSQL 17. Jika berbeda, isi `PG_BIN` seperti pada bagian 3. |
| Database belum tersambung | Jalankan `npm.cmd run db:local:up`, lalu `npm.cmd run db:local:status`. Jika tetap gagal, periksa pesan terminal dan kecocokan koneksi `.env` bersama pengembang. |
| Halaman tidak terbuka | Pastikan perintah aplikasi masih berjalan. Gunakan port 5173 untuk `dev`, atau 3001 untuk `start`. |
| Port sudah dipakai / `EADDRINUSE 127.0.0.1:3001` | Backend lain masih memakai port 3001, misalnya hasil build dari `npm.cmd start` bersamaan dengan `npm.cmd run dev`. Gunakan satu backend saja. Hentikan proses lama yang sudah dikenali sebelum menjalankan `dev`. Menyimpan `.env` dapat memicu restart normal; tidak perlu menjalankan backend tambahan. |
| Login gagal | Gunakan email dan kata sandi akun aplikasi. Jika ini pemasangan pertama, pastikan langkah `db:bootstrap` sudah berhasil. |
| Berhasil masuk tetapi daftar proyek kosong | Periksa apakah proyek sudah dibuat serta akun memiliki penugasan aktif yang sesuai. |
| Pekerjaan tidak bisa diubah setelah rencana diterbitkan | Dasar perhitungan sudah terkunci. Gunakan perubahan rencana untuk mengubah target/jadwal; volume dan harga tidak dibuka kembali melalui edit biasa. |
| Rencana belum dapat diterbitkan | Pastikan yang masuk adalah TL proyek, total nilai pekerjaan lebih dari nol, jumlah target setiap item 100%, dan tanggal berlaku memenuhi aturan. |
| Laporan tidak dapat disimpan | Periksa tanggal dalam jadwal rencana yang berlaku, minimal satu uraian kegiatan, nilai tenaga kerja, serta alasan material ditolak. |
| Laporan tidak dapat dikirim | Pastikan setiap kegiatan dengan volume positif sudah memiliki foto. Jika laporan berubah pada tab lain, muat ulang dan periksa versi terakhir. |
| Foto ditolak | Gunakan JPEG/PNG yang dapat dibuka normal, maksimal 5 MiB dan 20 juta piksel. Mengganti nama berkas menjadi `.jpg` tidak mengubah isinya menjadi foto. |
| Owner belum melihat laporan | Pastikan laporan sudah disetujui TL dan penugasan Owner pada proyek masih aktif. Koreksi yang belum disetujui belum terlihat. |

Untuk memeriksa backend, buka **http://127.0.0.1:3001/api/health**. Jika siap, browser menampilkan data dengan status `ok`. Alamat ini hanya untuk pemeriksaan layanan, bukan halaman utama aplikasi.

Jangan menghapus `.env`, folder `data/postgres`, atau `data/postgres-local.json` sebagai langkah mencoba memperbaiki masalah. Folder dan berkas tersebut berkaitan dengan data serta akses database lokal.

## 9. Bacaan lanjutan

- [README](../README.md): perintah setup dan pengujian yang lebih teknis, termasuk pilihan memakai PostgreSQL yang dikelola sendiri.
- [Progres pengerjaan](progress.md): fitur yang sudah selesai dan hasil pengujiannya.
- [Rencana implementasi](implementation-plan.md): urutan fitur yang akan dikerjakan.
- [Arsitektur](architecture.md): penjelasan lebih rinci tentang susunan aplikasi.

Panduan navigasi diperbarui **2 Oktober 2026** setelah perombakan UI/UX.

## Melihat kemajuan pekerjaan

1. Masuk lalu buka **Proyek**, pilih proyek Anda, dan tekan **Rincian kemajuan**.
2. Pilih **Awal periode** dan **Sampai tanggal**. Cut-off berarti batas tanggal yang ingin dihitung, termasuk tanggal tersebut.
3. Biarkan **Rencana pembanding** otomatis, atau pilih versi tertentu untuk membandingkan target. Tekan **Tampilkan Kemajuan** setelah mengubah pilihan.
4. Baca **Sebelumnya** (sebelum awal periode), **Periode ini** (dari awal sampai cut-off), dan **Kumulatif** (gabungan keduanya).
5. Lihat **Laporan sumber perhitungan** untuk membuka laporan yang menyumbangkan angka. Tanggal kegiatan dan waktu persetujuannya bisa berbeda.

Contoh: pekerjaan galian memiliki kontrak 1.000 m³ dan bobot 10% dari seluruh proyek. Jika 250 m³ sudah disetujui, pekerjaan galian selesai 25%, dan menyumbang **2,5%** pada total proyek. Bila kemudian dikoreksi menjadi 200 m³ dan disetujui lagi, sumbangannya menjadi **2%**. Catatan lama tetap tersimpan.

**Deviasi** adalah aktual dikurangi target, dalam poin persentase. Jika aktual 42% dan target 45%, deviasinya −3 poin persentase. Angka ini ditampilkan apa adanya agar tim dapat menilai penyebabnya.

Laporan yang baru disimpan, sedang diperiksa atau perlu diperbaiki belum dihitung. Koreksi yang belum disetujui juga belum menggantikan angka lama. Jika persetujuan datang terlambat, angkanya masuk ke tanggal kegiatan, sehingga angka periode lama bisa diperbarui.

Memilih rencana lain mengubah target pembanding, tetapi tidak mengubah pekerjaan nyata yang sudah disetujui. Memilih satu pekerjaan hanya menyaring rincian; bagian **Total proyek** tetap mencakup seluruh pekerjaan. Inspector dapat melihat total proyek, tetapi tautan sumber hanya menampilkan laporannya sendiri.

Di HP, geser tabel ke samping untuk melihat kolom lainnya. Tanda **—** berarti angka belum dapat dihitung, misalnya belum ada Rencana Awal atau pembaginya nol. Angka tampil sampai enam angka di belakang koma untuk menjaga ketelitian. Tidak perlu membuat database atau mengubah tabel untuk menggunakan fitur ini.

## Membuka laporan mingguan dan bulanan

1. Masuk, buka **Proyek**, lalu pilih proyek Anda.
2. Buka **Laporan → Rekap**.
3. Pilih **Jenis laporan**, lalu **Periode laporan**. Minggu mengikuti aturan versi rencana yang digunakan; bulan dihitung sejak tanggal mulai proyek, bukan selalu tanggal 1 kalender.
4. Pilih rencana pembanding bila diperlukan, lalu tekan **Tampilkan Laporan**.
5. Baca identitas kontrak, ringkasan, daftar pekerjaan, dan rincian sumber. Tekan nomor laporan harian untuk memeriksa asal data.

Contoh rencana baru: proyek mulai Kamis 16 Juli 2026. Minggu pertama adalah 16–19 Juli, minggu kedua 20–26 Juli. Bulan pertama adalah 16 Juli–15 Agustus. Jika pekerjaan berakhir 18 Agustus, bulan kedua hanya 16–18 Agustus.

Kolom **sebelumnya** membawa hasil sebelum awal periode, **periode ini** memuat kegiatan di dalam periode, dan **kumulatif** menggabungkan keduanya. Jangan menjumlah kolom kumulatif dari beberapa minggu untuk mencari hasil bulanan karena pekerjaan lama akan terhitung berulang.

Jika belum ada laporan sah pada periode yang dipilih, bagian sumber akan kosong dan progress periode tersebut nol. Angka sebelumnya tetap dibawa. Bila Rencana Awal belum dibuat, aplikasi memberi penjelasan bahwa basis perhitungan belum tersedia.

Daftar periode mencakup perpanjangan dari rencana yang sudah diterbitkan. Memilih versi pembanding tidak mengubah tanggal periode. Untuk periode yang belum berakhir, target ditampilkan sampai akhir periode, sedangkan aktual hanya berasal dari kegiatan yang sudah disetujui.

Rincian tenaga kerja, material/alat dan masalah ditampilkan menurut laporan harian sumber. Angka tenaga kerja bukan jumlah orang unik selama sebulan. Identitas persetujuan merujuk pemeriksa laporan harian, bukan tanda tangan otomatis untuk laporan bulanan. Inspector hanya melihat rincian laporannya sendiri, sementara angka progress mencakup semua sumber sah proyek.

Laporan dapat dibaca pada halaman web dan diunduh melalui **Pratinjau cetak / Unduh**. Di HP, geser tabel ke samping untuk membaca seluruh kolom.

## Menggunakan Ringkasan, Grafik, Galeri, dan Riwayat

1. Pilih proyek dari **Beranda** atau **Proyek**. Halaman awal proyek adalah **Ringkasan**.
2. Baca capaian, target, selisih, sisa hari, masalah, dan langkah berikutnya. Nama proyek serta status selalu terlihat di atas. Informasi kontrak ada di **Tim & Informasi → Informasi proyek**.
3. Buka **Tanggal dan pembanding grafik** untuk mengganti **Sampai tanggal**, periode, atau rencana pembanding. Tekan **Tampilkan Ringkasan**. Buka **Grafik rencana dan capaian** untuk grafik tiga seri, dan **Lihat angka grafik** untuk angkanya.
4. Pilih **Dokumentasi**, lalu buka **Filter foto** bila ingin menyaring berdasarkan tanggal, pekerjaan, laporan, atau pengunggah. Foto terhubung dengan laporan sumber.
5. Dari Ringkasan, tekan **Riwayat proyek** untuk memeriksa perubahan yang boleh Anda akses. Di HP, pindah bagian melalui **Bagian proyek**.

Isi ringkasan mengikuti tugas pengguna. Administrator melihat jumlah proyek/pengguna dan aktivitas sistem. Owner melihat perkembangan proyek dan laporan sah. Team Leader melihat antrean pemeriksaan, pekerjaan, masalah dan perubahan rencana. Engineer melihat pekerjaan/progress serta catatan teknis. Inspector melihat proyek dan laporan miliknya, termasuk yang belum dikirim atau perlu diperbaiki.

Target pada kartu memakai rencana yang berlaku pada cut-off. Grafik dapat memakai versi terbaru yang baru berlaku pada masa depan untuk perbandingan. Memilih versi lain tidak mengubah pekerjaan nyata yang sudah disetujui. Garis aktual berhenti di cut-off dan tidak meramalkan pekerjaan masa depan.

Cut-off mengatur angka progress/grafik. Antrean, catatan, foto dan riwayat menunjukkan keadaan terbaru; halaman ini bukan salinan seluruh keadaan aplikasi pada tanggal lampau. Owner tidak melihat foto atau catatan dari draf dan koreksi yang belum disetujui. Inspector hanya dapat membuka rincian laporannya sendiri.

Status proyek otomatis menjadi **Selesai** ketika semua volume yang menyumbang bobot proyek sudah terpenuhi melalui laporan sah. Selama belum selesai, tanggal dan jadwal rencana yang berlaku menentukan status berjalan/terlambat. Administrator atau TL tetap dapat melakukan koreksi status dengan alasan. Tanda minus pada selisih tidak otomatis menjadi penilaian bagus/buruk atau status terlambat.

Belum ada rencana, laporan atau foto akan ditampilkan sebagai keadaan kosong, bukan angka buatan. Jika koneksi gagal, tekan **Coba Lagi**. Fitur tetap untuk prototype. Unduhan PDF/Excel tersedia melalui tindakan **Pratinjau cetak / Unduh** pada laporan atau rekap.


## Mengunduh laporan dan menyaring daftar laporan

Pilih proyek → **Laporan → Rekap → Jenis rekap lainnya**. Dari detail laporan atau Rincian kemajuan, Anda juga dapat membuka **Pratinjau cetak / Unduh** dengan pilihan yang sudah terisi. Pilih satu dari delapan jenis laporan. Untuk harian, pilih laporan yang ingin dibuka. Untuk mingguan/bulanan, isi nomor periode atau biarkan kosong untuk periode saat ini. Jenis lainnya dapat memakai tanggal awal dan cut-off (tanggal terakhir yang dihitung). Tekan **Tampilkan Laporan**, periksa isinya, kemudian **Unduh PDF** atau **Unduh Excel**.

PDF cocok untuk dibaca/dicetak. Excel cocok untuk menelusuri angka; gambar grafik disertai tabel sumber. Rekap tenaga kerja bukan jumlah orang unik. Material yang satuannya berbeda tidak dijumlahkan menjadi satu. Penjelasan lengkap dan perbedaan dengan workbook contoh ada di [panduan ekspor](ekspor.md).

Pada **Laporan Harian**, buka **Filter laporan**, isi tanggal, minggu, bulan, status atau pembuat lalu tekan **Terapkan Filter**. Minggu mengikuti versi rencana masing-masing laporan; bulan dihitung dari awal proyek. Pilih proyek lain lewat Daftar Proyek. Tekan **Bersihkan Filter** untuk kembali melihat semua laporan yang boleh Anda akses.


### Layout laporan mengikuti workbook

Buka **Pratinjau cetak** untuk melihat formulir workbook. PDF dan Excel tetap memakai formulir tersebut: kop laporan, kelompok kolom, warna, garis tabel dan area pengesahan. Laporan yang panjang dilanjutkan ke lembar/halaman berikutnya; rincian lengkap tetap tersedia pada lampiran. Logo contoh aktif secara bawaan. Bila instansi/perusahaan berbeda, buka **Pilihan cetak**, hapus centang **Gunakan logo dari workbook contoh**, lalu tampilkan pratinjau kembali sebelum mengunduh.

Tanggal dan angka tetap berasal dari aplikasi. Nama penandatangan, PPN dan pembulatan yang belum tersedia tidak diganti dengan data contoh.

### Mengisi nama kontraktor

Pada **Tambah Proyek → Identitas dan pihak terkait**, isi kolom **Nama kontraktor** dengan nama perusahaan pelaksana. Untuk proyek yang sudah ada, buka **Ubah Proyek**. Kolom ini terpisah dari Pemberi pekerjaan, Nama instansi, dan Konsultan supervisi. Proyek lama awalnya memiliki nilai kosong; nama tidak diambil otomatis dari logo workbook atau Keterangan.

Nama tersebut tampil pada detail proyek, ringkasan laporan harian, pratinjau dan ekspor PDF/Excel. Identitas kontraktor mengikuti data proyek saat laporan dibuka/diekspor; perubahan nama tidak mengubah volume atau persetujuan laporan. Logo contoh tetap diatur melalui pilihan logo pada ekspor.

### Mengambil daftar pekerjaan dari workbook TS

Masuk sebagai Administrator atau Team Leader, buka proyek dengan daftar pekerjaan kosong, lalu **Daftar Pekerjaan → Lihat Pekerjaan dari Workbook TS**. Periksa 7 kelompok dan 38 item, kemudian klik **Impor Pekerjaan TS ke Proyek Ini**. Uraian mengikuti sheet TS; satuan, volume, dan harga mengikuti M1. Angka yang dibulatkan ditandai saat pratinjau. Pekerjaan tersimpan dalam database dan tidak hilang setelah halaman dimuat ulang.

Tombol hanya tersedia sebelum daftar terisi dan sebelum Rencana Awal mengunci basis. Data lama tidak ditimpa. Rencana, laporan dan realisasi tetap dibuat melalui alur aplikasi. Panduan dari pembuatan akun sampai Owner memantau tersedia pada [panduan demo](demo-guide.md).
