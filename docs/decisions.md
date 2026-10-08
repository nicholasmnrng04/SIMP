# Keputusan prototype SIMP

Dicatat pada T00, 28 September 2026. Dokumen ini memisahkan pilihan implementasi dari persyaratan PRD. Semua asumsi bisnis dapat diperbarui jika pengguna memberi aturan berbeda; catat alasan dan dampak perubahan terhadap data/test.

## Keputusan teknis yang diterapkan pada T00

| ID | Keputusan | Konsekuensi |
| --- | --- | --- |
| D01 | React/Vite + Fastify dalam satu repository TypeScript | Batas frontend/API/service jelas, satu proses untuk demo hasil build |
| D02 | PostgreSQL 17.11 via pg 8.23.0, SQL migration, tanpa ORM | Menggantikan SQLite atas permintaan pengguna setelah T00; perlu server PostgreSQL lokal |
| D03 | Migration transaksional dan checksum, hanya tambah versi | Tidak menimpa schema lama secara diam-diam; gagal berarti rollback |
| D04 | Uang kontrak sebagai integer sen, tanggal bisnis `YYYY-MM-DD`, timestamp audit UTC | Menghindari pecahan biner uang dan pergeseran hari akibat konversi timezone |
| D05 | Bootstrap lokal, scrypt, tanpa kredensial bawaan | Pengguna mengisi rahasia di .env; bootstrap diuji memakai database sementara |
| D06 | Storage foto lokal privat | T05 harus menyediakan endpoint akses berotorisasi, bukan URL static bebas |
| D07 | Pin versi dependensi dalam manifest dan lockfile | Upgrade harus diikuti build/test; versi runtime dicatat di arsitektur |
| D08 | Tidak membangun endpoint CRUD/login di T00 | T00 memvalidasi fondasi; alur role/login dimulai T01 |
| D09 | Cluster SIMP terpisah di 127.0.0.1:55432; akun simp_app bukan superuser | Memakai instalasi PostgreSQL existing tanpa mengubah layanan/datanya; password acak di .env lokal |
| D10 | Pool dan transaksi asinkron pada client yang sama, advisory lock migration/bootstrap | Query serentak tidak menggandakan migration atau akun; client selalu dilepas |
| D11 | Tes memakai schema PostgreSQL acak dengan search_path terisolasi | Perilaku database diuji nyata; cleanup hanya pada schema yang dibuat tes |

SQL dan database SQLite awal dipertahankan sebagai arsip. Pemeriksaan sebelum perpindahan menemukan nol akun/proyek/penugasan/audit, jadi tidak ada data bisnis untuk diimpor. Migration PostgreSQL memiliki jalur tersendiri; bukan penimpaan histori migration SQLite.

## Keputusan T01 — 29 September 2026

| ID | Keputusan | Konsekuensi |
| --- | --- | --- |
| D12 | Token sesi acak 32 byte, hanya hash SHA-256 di PostgreSQL, kedaluwarsa absolut 8 jam | Cookie HttpOnly/SameSite=Lax; sesi bertahan restart dan dapat dicabut backend |
| D13 | Role/status/password berubah mencabut seluruh sesi pengguna secara transaksional | Masuk ulang wajib; mengaktifkan akun kembali tidak memulihkan sesi lama; nama/email saja tidak memutus sesi |
| D14 | Origin mutasi harus cocok APP_ORIGINS; login maksimal 20/menit/IP | Default origin demo lokal; limiter satu proses; konfigurasi HTTPS memakai COOKIE_SECURE=true |
| D15 | Administrator mengelola daftar global; role lain ditolak backend | Direktori Owner/TL yang dibatasi proyek disediakan pada T02, bukan akses daftar global |
| D16 | Minimal satu Administrator aktif, penonaktifan menggantikan hard delete | Menjaga akses pengelolaan dan referensi audit; perubahan bersamaan diserialisasi advisory lock |

## Keputusan T02 — 29 September 2026

| ID | Keputusan | Konsekuensi |
| --- | --- | --- |
| D17 | Penghapusan proyek diwujudkan sebagai arsip dengan konfirmasi dan alasan | Tidak ada hard delete/cascade; data proyek, penugasan dan audit tetap ada; arsip hanya dapat dibaca dan tersembunyi dari daftar default |
| D18 | Status otomatis dihitung pada saat baca: sebelum mulai = Belum Dimulai; mulai sampai selesai inklusif = Berjalan; lewat selesai = Terlambat | Belum memakai progress; UI menjelaskan keterbatasan. Selesai/Ditutup memerlukan koreksi manual beralasan, termasuk alasan ketika kembali otomatis |
| D19 | Akses non-Admin membutuhkan akun aktif, role global sama dengan role penugasan, penugasan aktif, tanggal hari ini dalam periode inklusif | Masa penugasan dinilai dalam timezone proyek; role akun berubah tidak mewarisi hak penugasan lama. Periode boleh mencakup persiapan/pasca pelaksanaan |
| D20 | Satu TL penanggung jawab melalui informasi proyek; pembuat TL wajib menjadi penanggung jawab | Penugasan otomatis mulai hari pembuatan, tanpa akhir, agar proyek mendatang dapat dipersiapkan. Admin dapat mengubah periode/status TL; pergantian TL menonaktifkan penugasan TL lama |
| D21 | Admin menetapkan Owner/TL; TL mengelola Engineer/Inspector proyeknya | Mengikuti rincian PRD §4.3/UC-04. Kandidat hanya id/nama/role aktif yang boleh ditugaskan; Owner melihat direktori anggota proyek, bukan daftar akun global |
| D22 | Nilai kontrak API berupa string rupiah dengan maksimal dua desimal, disimpan BIGINT sen | Konversi BigInt tanpa pecahan biner, batas 9.007.199.254.740.991 sen; durasi disimpan sebagai kolom generated dari tanggal inklusif |
| D23 | Mutasi proyek/tim memakai lock proyek serta pemeriksaan ulang akses dalam transaksi; periode penugasan aktif tidak boleh overlap untuk pengguna/proyek sama | Penugasan serentak tidak menggandakan akses; identitas penugasan tidak diganti, nonaktifkan yang lama lalu buat baru; audit mencatat perubahan |

## Keputusan T03 — 29 September 2026

| ID | Keputusan | Konsekuensi |
| --- | --- | --- |
| D24 | Jenis GROUP adalah wadah agregat; ITEM adalah pekerjaan kuantitatif tanpa anak | Induk hanya GROUP dalam proyek yang sama; GROUP tidak memiliki volume/harga/satuan sendiri; satu parent per baris, jenis tidak diubah setelah dibuat |
| D25 | Volume NUMERIC(18,6), harga NUMERIC(14,2); kalkulasi BigInt berskala, nilai produk tepat 8 desimal | Maksimal 12 angka bulat untuk input volume/harga; tidak perlu pustaka decimal tambahan pada T03. Nilai/bobot tidak diduplikasi sebagai kolom bisnis yang dapat diedit |
| D26 | Bobot berasal dari nilai item/total nilai seluruh item, kelompok hanya agregat | Status ACTIVE/INACTIVE bersifat administratif dan tidak mengeluarkan nilai dari basis kontrak; kode unik per proyek; tidak ada editor bobot manual |
| D27 | Rasio dihitung dari nilai tepat; bobot API 6 desimal, tampilan uang/bobot 2 desimal dengan half-up | Total bobot matematis 100% jika nilai positif; jumlah bobot tampilan diberi peringatan jika beda lebih dari 0,01 poin; total nol menghasilkan bobot null dan peringatan, bukan NaN |
| D28 | Hook internal freezeWorkBasis disiapkan untuk transaksi penerbitan Rencana Awal T04; tidak ada endpoint/tombol penguncian T03 | TL proyek yang mengunci; penambahan/penghapusan serta kode, struktur, satuan, volume, harga dan jadwal diblokir setelah terkunci. Nama/uraian/status/keterangan boleh diedit dan diaudit; tidak ada unlock |
| D29 | Jadwal pekerjaan opsional, kedua tanggal harus diisi bersama dan berada di jadwal proyek | Penyempitan jadwal proyek yang mengeluarkan pekerjaan ditolak; setelah basis terkunci, perubahan jadwal proyek biasa ditolak sampai tersedia alur revisi T04 |
| D30 | Hapus hanya item/kelompok tanpa turunan atau referensi dan sebelum penguncian | Foreign key RESTRICT mempertahankan referensi; audit penghapusan menyimpan data sebelumnya. Mutasi mengunci proyek agar siklus/duplikasi serentak tidak lolos |

## Keputusan T04 — 29 September 2026

| ID | Keputusan | Konsekuensi |
| --- | --- | --- |
| D31 | Minggu tujuh hari sejak tanggal mulai; bulan kalender dari tanggal asli dengan clamp akhir bulan | Periode terakhir parsial; tanggal bisnis tanpa pergeseran timezone. Workbook memakai tabel tanggal eksternal/minggu pertama empat hari, sehingga PRD menjadi acuan periode aplikasi |
| D32 | Satu granularitas sumber per versi; target fisik incremental per ITEM tepat 100%, maksimal enam desimal | Granularitas lain berasal dari alokasi harian merata; nilai nol tetap ditargetkan namun kontribusi nol. Pergantian granularitas/jadwal meminta target ulang |
| D33 | Alokasi harian dan bobot memakai pecahan BigInt tepat, pembulatan sesudah agregasi | API angka enam desimal hanya representasi; modul selanjutnya wajib memakai sumber/rational calculator, bukan angka tampilan |
| D34 | Hanya TL menerbitkan; baseline dan revisi langsung menjadi versi terbit immutable | Tidak ada draft persisten atau delete/overwrite publikasi; review tiga langkah sebelum terbit. Trigger DB melindungi versi/item terbit, FK menjaga proyek |
| D35 | Baseline sejak start proyek; revisi setelah effective_date terakhir dan tidak sebelum hari ini proyek | Satu versi berlaku per cutoff; future tidak aktif dini. Tidak ada pembatalan versi masa depan pada prototype; koreksi lewat versi baru dengan tanggal berikutnya |
| D36 | Snapshot basis baseline tetap; start tidak bergeser, end/target dapat direvisi per versi | Tanggal pada informasi proyek tetap jadwal kontrak; versi menyediakan jadwal pelaksanaan efektif. T05/T07 wajib memilih versi sesuai cutoff; versi lama dan sumber aktual tidak ditulis ulang |
| D37 | Lock proyek + previousVersionId + hash daftar pekerjaan sebelum publikasi | Menolak editor basi, double submit dan konflik publikasi; freeze baseline, versi, target dan audit satu transaksi |
| D38 | Batas 3.660 hari, 500 item dan 20.000 nilai target per versi | Menjaga editor/query prototype tetap terbatas; belum ada pagination versi atau autosave draf |

## Keputusan T05 — 29 September 2026

| ID | Keputusan | Konsekuensi |
| --- | --- | --- |
| D39 | Draf wajib tanggal dan minimal satu kegiatan; unik per proyek/tanggal/pembuat | TL/Inspector membuat dan mengubah draf sendiri; Inspector lain tidak membaca/mengeditnya. Nomor laporan otomatis per proyek, tidak digunakan ulang setelah hapus |
| D40 | Tanggal maksimal hari ini dan harus berada pada jadwal versi efektif di tanggal kegiatan | plan_version_id serta identitas proyek/kontrak disimpan; perpanjangan sah digunakan tanpa mengubah snapshot laporan lama |
| D41 | Naratif memakai quantity null; kuantitatif wajib ITEM proyek dan satuan dari basis | Jumlah volume satu laporan <= kontrak diperiksa tepat; batas kumulatif lintas laporan dan sumber progress mengikuti T06/T07 |
| D42 | Semua kegiatan dengan volume positif memerlukan satu foto sebelum kirim | Kebijakan foto sederhana untuk semua pekerjaan kuantitatif; draf boleh disimpan tanpa foto; tidak ada pengaturan khusus per pekerjaan pada T05 |
| D43 | Foto JPEG/PNG 5 MiB, 20 juta piksel, 20 foto/laporan; decode dan simpan ulang JPEG dengan Sharp 0.35.5 | Menolak berkas palsu/rusak, membatasi pemrosesan dan membuang metadata bawaan. Caption/lokasi/tanggal eksplisit tetap tersedia; file storage privat |
| D44 | Admin/TL/Engineer membaca sesuai proyek; Owner hanya APPROVED; berkas/galeri mengikuti aturan laporan | Owner belum melihat laporan T05 karena approval belum dibangun. TL tidak menimpa draf Inspector; pemeriksaan menggunakan alur T06 |
| D45 | editVersion dan lock proyek untuk simpan, upload/hapus foto serta kirim | Edit basi/kirim ganda ditolak; kirim mengunci edit/unggah/hapus. Tidak ada posting aktual atau approval di T05 |
| D46 | Tenaga kerja per jenis, jam 0–24; cuaca tiap waktu unik dan satu tanggal; material/masalah bertanggal laporan | Malam boleh kosong; material ditolak wajib alasan. Foto mengikuti tanggal laporan. Pergantian tanggal/pekerjaan kegiatan berfoto meminta hapus foto dahulu |
| D47 | Metadata transaksional, file ditulis privat dan dibersihkan saat rollback/hapus | Crash proses atau kegagalan hapus masih dapat meninggalkan file tanpa referensi; tidak dilayani endpoint. Backup harus mencakup DB dan storage; rekonsiliasi otomatis belum dibuat |

## Keputusan T06 — 29 September 2026

| ID | Keputusan | Alasan dan batas |
| --- | --- | --- |
| D48 | Engineer mencatat temuan ketika SUBMITTED; hanya TL dengan penugasan aktif memutus | Catatan Engineer tidak mengubah status; bukan prasyarat wajib persetujuan. TL boleh menyetujui laporannya sendiri sesuai PRD |
| D49 | Permintaan perbaikan membuka edit pembuat pada NEEDS_REVISION, lalu kirim ulang | Alasan wajib minimal tiga karakter; snapshot pemeriksaan menyimpan seluruh isian/foto sebelum keputusan. Laporan yang pernah diperiksa tidak dapat dihapus |
| D50 | Koreksi dibuat pembuat aktif dari versi sah terbaru; tanggal/pembuat/nomor tetap | logical_id + revision membedakan versi; previous_report_id dan alasan wajib. Satu koreksi belum selesai per laporan. Alih kepemilikan ketika pembuat nonaktif belum tersedia |
| D51 | approved_report_sources memilih tepat satu versi sah per laporan logis | Persetujuan, catatan, audit dan penggantian sumber satu transaksi dengan lock proyek. T07 wajib join melalui tabel ini; seluruh baris APPROVED termasuk arsip tidak boleh langsung dijumlah |
| D52 | editVersion bertambah pada setiap catatan/keputusan; permintaan basi mendapat 409 | Klik ganda hanya satu efek, bukan dua keputusan. Pengguna memuat ulang setelah konflik. Tidak menyediakan replay respons sukses untuk permintaan lama |
| D53 | Foto koreksi memiliki UUID dan salinan berkas sendiri | Menghapus/mengganti foto koreksi tidak merusak versi lama. Snapshot metadata mempertahankan pengunggah/waktu asli; kejadian penyalinan tercatat pada audit koreksi. Biaya storage bertambah per versi |
| D54 | Validasi volume kumulatif saat kirim dan persetujuan, dengan BigInt enam desimal | Jumlah versi sah lain + calon versi <= kontrak tetap; kontribusi lama dari laporan logis yang sama dikecualikan. Approval lintas laporan diserialisasi oleh lock proyek |
| D55 | Owner dapat membaca semua versi APPROVED, termasuk arsip yang digantikan | Koreksi belum disetujui, foto dan metadata historinya disembunyikan. UI membedakan sumber berlaku dan arsip. Agregat T07 hanya memakai sumber berlaku |
| D56 | Database melindungi header/rincian APPROVED dari UPDATE/DELETE dan penambahan rincian | Constraint versi/FK/sumber memperkuat guard service. Perhitungan persen/kurva/posting cache belum dibuat; T06 hanya menetapkan sumber yang sah |
| D57 | Migration 007 dipertahankan persis versi yang sudah diterapkan; guard tambahan berada pada 008 | Pemulihan 30 September 2026 membuktikan checksum isi asli cocok dengan history. Tidak mengubah checksum/history manual atau menonaktifkan verifikasi; migration baru diterapkan normal dan data tetap sama |

## Asumsi bisnis untuk tahap berikutnya

Aturan rinci dan contoh angka: [domain-rules.md](../skills/simp-prototype/references/domain-rules.md). Belum ada service progress/periode yang diimplementasikan pada T00.

| ID | Asumsi awal | Validasi saat |
| --- | --- | --- |
| B01 | Zona waktu proyek default Asia/Jakarta, dapat dikonfigurasi; tidak mengikuti mesin secara implisit | T02/T04 |
| B02 | Minggu dimulai dari start proyek, tujuh hari; bulan dari tanggal start + bulan kalender, clamp akhir bulan dari tanggal asli; akhir inklusif | T04; bandingkan workbook |
| B03 | Durasi inklusif; sisa hari tidak memasukkan hari laporan; laporan di luar tanggal pelaksanaan ditolak sampai jadwal direvisi | T04/T05 |
| B04 | Bobot otomatis dari volume × harga, hanya daun dihitung; toleransi peringatan total 0,01 poin persentase | T03 |
| B05 | Persen disimpan 0–100; weighted = physical × weight / 100; pembulatan hanya untuk tampilan | T03/T07 |
| B06 | Setelah baseline terbit, basis volume/harga/bobot/unit/struktur dibekukan; revisi rencana hanya target/jadwal | T04 |
| B07 | Perubahan nilai kontrak berjalan merupakan metadata teraudit, tidak otomatis mengubah basis progress | T02/T04 |
| B08 | Volume aktual melebihi kontrak ditolak secara eksplisit saat kirim/setujui; tidak di-clamp | T05/T07 |
| B09 | Satu granularitas sumber mingguan/bulanan per versi; lainnya diturunkan dari alokasi tanggal merata dalam periode | T04; verifikasi formula workbook |
| B10 | Baseline adalah identitas versi pertama; rencana efektif sesuai cutoff, versi masa depan belum aktif; tanggal berlaku duplikat/backdate yang menimpa periode berlaku ditolak | T04 |
| B11 | Satu laporan logis per proyek/tanggal/pembuat; revisi memakai identitas logis sama | T05/T06 |
| B12 | Laporan menunggu pemeriksaan dikunci; laporan sah dikoreksi melalui revisi turunan beralasan dan approval ulang | T06 |
| B13 | Saat koreksi disetujui, kontribusi resmi diganti secara atomik; versi lama dipertahankan | T06/T07 |
| B14 | Approval terlambat mengikuti tanggal kegiatan; perubahan angka akibat approval/koreksi tercatat, sedangkan revisi rencana tidak pernah mengubah aktual | T07 |
| B15 | Role global membatasi kemampuan, penugasan aktif membatasi proyek; Owner melihat direktori tim seperlunya dan laporan/foto disetujui | T01/T02/T06 |
| B16 | Engineer memberi catatan teknis, hanya TL proyek memutus persetujuan; Admin tidak punya approval teknis | T06 |
| B17 | Rekap tenaga kerja membedakan jumlah per hari, orang-hari dan orang-jam dari orang unik | T08/T10 |
| B18 | Tidak ada editor progress manual bebas walaupun contoh schema menyebut MANUAL | T07 |

## Keputusan T07 — 30 September 2026

| ID | Keputusan | Konsekuensi |
| --- | --- | --- |
| D58 | Progress dihitung langsung dari pointer sumber T06; tanpa materialisasi | Tidak perlu migration 009 atau tabel progress tambahan. Angka dapat dihitung ulang dan koreksi tidak menggandakan kontribusi |
| D59 | Basis aktual adalah snapshot Rencana Awal; target memakai pilihan versi | Pergantian rencana hanya mengubah target/deviasi, tidak mengubah volume atau aktual berbobot. Rentang tanggal aktual tetap sama |
| D60 | Pecahan BigInt sampai batas API, pembulatan enam desimal | Jumlah angka tampilan dapat berbeda 0,000001 dari hasil kumulatif; perhitungan tidak menjumlah hasil pembulatan |
| D61 | Cut-off mengikuti tanggal kegiatan, menggunakan versi laporan sah saat pembacaan | Approval terlambat/koreksi dapat mengubah angka periode lama, dengan audit T06. Belum menyediakan snapshot keadaan pada timestamp persetujuan lampau |
| D62 | Semua role berhak melihat agregat proyek sesuai penugasan; jejak Inspector terbatas miliknya | Total tetap seluruh proyek. API memberi penanda pembatasan jejak, tanpa membocorkan rincian laporan Inspector lain atau koreksi pending |
| D63 | Query progress memegang SHARE lock proyek sepanjang transaksi | Pembacaan tidak mencampur pointer sumber/basis/rencana sebelum dan sesudah perubahan. Mutasi yang memakai UPDATE lock menunggu pembacaan selesai |
| D64 | Filter pekerjaan hanya membatasi rincian, total tetap seluruh proyek | UI memberi penjelasan eksplisit. Kelompok tidak menjumlah volume/satuan berbeda; deviasi adalah poin persentase tanpa label penilaian otomatis |

## Tambahan T08 — 30 September 2026

| ID | Keputusan | Konsekuensi |
| --- | --- | --- |
| D65 | Batas periode berasal dari awal baseline sampai akhir terjauh kontrak/rencana terbit | Perbandingan versi mempertahankan rentang aktual yang sama. Perpanjangan terbit dapat memperpanjang periode terakhir yang sebelumnya parsial; UI selalu menunjukkan tanggal persis |
| D66 | Cut-off laporan adalah akhir periode inklusif; default periode hari proyek | Periode belum selesai diberi penjelasan target penuh vs aktual sah saat pembacaan. Hari ke-/sisa hari memakai akhir periode dan jadwal rekap |
| D67 | Metadata kontrak/proyek terkini dan basis baseline ditampilkan terpisah | Nilai kontrak berjalan tidak menjadi denominator progress. Laporan web bukan arsip immutable hasil ekspor |
| D68 | Satu transaksi dan service progress untuk rekap, tanpa tabel agregat baru | Koreksi/persetujuan tidak menghasilkan pembacaan setengah sebelum/sesudah. Tidak perlu migration atau perubahan history |
| D69 | Rincian tenaga kerja/material/masalah per laporan sah, dengan pembatasan Inspector | Tidak mengarang jumlah orang unik atau menjumlah material beda satuan. Laporan naratif sah tetap masuk rincian meskipun tidak menambah progress |
| D70 | Pengesahan ditampilkan dari pemeriksa aktual laporan harian | Nama TL saat ini hanya identitas proyek; tidak dipakai sebagai tanda tangan otomatis. Persetujuan rekap tersendiri belum dibutuhkan |

## Tambahan T09 — 30 September 2026

| ID | Keputusan | Konsekuensi |
| --- | --- | --- |
| D71 | Kartu memakai rencana efektif; grafik default memakai versi terakhir terbit | Versi masa depan boleh menjadi pembanding grafik dengan keterangan jelas, tetapi tidak aktif terlalu dini pada kartu |
| D72 | Kurva dihitung lewat sumber/kalkulator T07, titik akhir periode ditambah cut-off | Aktual setelah cut-off null. Pergantian pembanding tidak mengubah aktual. Data grafik tersedia sebagai tabel selain SVG |
| D73 | Gallery/history mengikuti akses laporan, bukan sekadar akses proyek | Owner tidak menerima foto/catatan draf atau pending correction. Inspector hanya rincian laporan sendiri. Foto arsip APPROVED boleh terlihat |
| D74 | Selesai otomatis membutuhkan volume seluruh item berbobot positif terpenuhi eksak | Tidak memakai pembulatan 100%. Jika belum selesai, tanggal dan akhir jadwal efektif menentukan Berjalan/Terlambat; override manual beralasan tetap berlaku |
| D75 | Riwayat memakai DTO aman, tidak mengirim JSON audit mentah | Label tindakan, pelaku, tanggal, alasan/versi dan tautan tersedia. Status yang ditampilkan adalah status laporan saat ini |
| D76 | Ringkasan proyek memisahkan cut-off angka dari antrean/riwayat terkini | Bukan snapshot historis semua keadaan sistem. Masalah mengikuti batas tanggal, antrean/catatan/foto mengikuti akses dan keadaan sekarang |
| D77 | Tanpa migration/materialisasi/dependensi grafik baru | SVG responsif, tabel angka, sumber langsung PostgreSQL. Pagination serta optimasi volume besar belum lingkup prototype |

## Keputusan T10

| ID | Keputusan | Alasan / batas |
| --- | --- | --- |
| D78 | Satu DTO untuk web/PDF/XLSX, sumber dibaca dalam transaksi proyek | Renderer tidak menghitung bisnis ulang; unduhan baru membaca keadaan terbaru, bukan snapshot pratinjau yang dipersistenkan |
| D79 | Cakupan ekspor mengikuti akses laporan dan sumber sah | Owner tidak mendapat draf, Inspector hanya rincian miliknya; status laporan harian dan sumber resmi selalu dijelaskan |
| D80 | PDFKit, ExcelJS, Noto Sans; A3 mendatar, header berulang | Grafik Excel berupa gambar dengan tabel angka, bukan objek chart Excel yang dapat diedit |
| D81 | Angka Excel numerik disertai lembar Nilai Eksak | Menjaga data sumber di luar batas presisi numerik Excel; teks pengguna tidak dibuat sebagai formula |
| D82 | Rekap tenaga kerja per kategori/jabatan; material per jenis/nama/satuan | Orang-hari dan orang-jam bukan individu unik; masalah adalah catatan per laporan |
| D83 | Filter laporan digabung setelah cakupan role/proyek | Minggu/bulan mengikuti awal baseline dan akhir jadwal terjauh; pencarian hanya menerima respons pilihan terbaru |
| D84 | Keputusan awal format bebas digantikan D86 pada 1 Oktober 2026 | Pengguna mewajibkan layout mengikuti workbook |
| D85 | Dua temuan audit moderat tetap dicatat, tanpa downgrade besar otomatis | ExcelJS memanggil UUID v4; advisory buffer v3/v5/v6 tidak digunakan alur ekspor ini. Tinjau ulang sebelum production |

## Data sumber baru dan keputusan terbuka

Workbook `LAPORAN PROYEK contoh.xlsx` tersedia. Inventaris lembar dan formula nilai/bobot sudah dibaca. Pemeriksaan periode T04 menemukan M1 mengambil batas tanggal dari tabel eksternal, memakai `(Q12*7)-3` untuk hari pelaksanaan, dan B1 mengambil akhir dari M5. Periode aplikasi mengikuti PRD/asumsi D31; kesamaan bulan dan alokasi target dengan workbook belum terbukti. Perbandingan T10 tercatat pada docs/ekspor.md; format tidak diklaim identik dan workbook tidak menjadi database runtime.

**Keputusan terbaru, 8 Oktober 2026:** instruksi pengguna menggantikan D31/B02 untuk versi rencana baru. Minggu pelaporan baru berjalan Senin–Minggu, dengan awal pada tanggal mulai proyek dan akhir pada tanggal selesai proyek; versi lama tetap memakai aturan asal. Migration 010 menyimpan penanda konvensi per versi. Target 38 pekerjaan dari sheet TS telah dibandingkan terhadap rencana proyek contoh: 25 berbeda. Satuan, volume dan harga 38 item cocok dengan M1; jumlah harga dan bobot cocok dalam presisi aplikasi (selisih jumlah harga terbesar Rp0,017 akibat volume enam desimal). Koreksi dilakukan sebagai versi baru, bukan perubahan Rencana Awal terbit. Bulan proyek tetap mengikuti aturan sebelumnya.

T03 memakai BigInt berskala untuk nilai/bobot pekerjaan; pustaka decimal belum diperlukan untuk operasi yang tersedia. Grafik, PDF, Excel dan batas upload dipilih pada tahap pemiliknya. Expiry sesi, Origin/CSRF dan validasi login telah ditetapkan di T01. Bagian yang belum tersedia tidak boleh dianggap sudah diimplementasikan.

Pemeriksaan terbatas workbook M1 pada T03 menemukan `K20 = H20*J20` dan `L20 = K20/$K$67*100`, sesuai formula nilai dan bobot PRD. Workbook juga memiliki formula ke sumber eksternal `[1]Data!…`; angka hasil cache bukan database aplikasi dan seluruh dependensi/formula belum dihitung ulang. T10 menguji kesetaraan pratinjau aplikasi dan ekspor, bukan kesetaraan layout workbook; perbedaan periode yang ditemukan T04 tercatat di atas.

Tidak ada deployment production atau pengembangan fitur §63 yang termasuk keputusan ini.


## Penyesuaian layout 1 Oktober 2026

| ID | Keputusan | Alasan / batas |
| --- | --- | --- |
| D86 | Layout workbook menjadi template utama web/PDF/XLSX | Mengikuti instruksi pengguna; geometri/style H0, M1, B1, TS diekstrak menjadi aset bersih dengan hash sumber |
| D87 | Isi template tetap DTO dari PostgreSQL | Formula/cache eksternal, nama contoh dan pengesahan tidak disalin; PPN/pembulatan belum dikonfigurasi dibiarkan kosong |
| D88 | Halaman lanjutan dan lampiran mempertahankan semua data | Formulir tetap sesuai susunan workbook; teks panjang atau rincian yang tidak muat tersedia pada lampiran |
| D89 | Logo workbook tampil secara bawaan dan dapat dimatikan | Pilihan logo belum dijawab saat pengerjaan; asumsi ini disampaikan kepada pengguna. Checkbox memungkinkan menghilangkan logo contoh jika instansi/perusahaan berbeda; identitas pada gambar logo tetap milik contoh |
| D90 | Demo memakai uraian TS melalui impor eksplisit ke proyek kosong | Arahan pengguna saat T11. 7 kelompok dan 38 item diambil dari TS; satuan/volume/harga M1. Tidak menimpa pekerjaan atau membuka basis terkunci. Impor transaksional, hak Admin/TL dan audit tetap berlaku |
| D91 | Volume workbook mengikuti presisi aplikasi | M1!H26 `622.1201983` menjadi `622.120198`; sumber diperlihatkan. Dua formula volume lokal H35/H37 ditelusuri ke angka literal; cache/formula eksternal, target dan aktual tidak diimpor |
| D92 | Skenario penerimaan memakai akun baru melalui UI | Bootstrap Administrator disediakan runner terisolasi; seluruh mutasi alur utama lewat formulir. Data sintetis hanya untuk tes deterministik; panduan demo memakai daftar pekerjaan workbook sesuai arahan pengguna |
| D93 | Nama kontraktor menjadi identitas proyek tersendiri | Perbaikan atas masukan pengguna setelah T11. Migration 009 memberi nilai awal kosong, maksimal 250 karakter. Nama tampil pada proyek/laporan/ekspor mengikuti identitas proyek saat ini, bukan mengubah histori volume/persetujuan. Tidak disimpulkan dari Keterangan atau logo contoh |
