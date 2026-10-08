# Hasil penerimaan prototype SIMP — T11

Tanggal pemeriksaan: 1 Oktober 2026. Acuan: PRD §79–82, §86–88, seluruh kriteria T00–T11 dan arahan pengguna agar layout serta uraian pekerjaan mengikuti workbook contoh. **T11 selesai dalam batas prototype.** Hasil akhir: 74/74 tes, build/typecheck dan smoke lulus. Regresi browser awal 46/48, kemudian 10/10 tes terkait lulus setelah perbaikan pemilihan akun fixture. Catatan lengkap ada pada [progres](progress.md).

## Cakupan dan bukti

| Kelompok | Status | Bukti implementasi dan pengujian |
| --- | --- | --- |
| §79 Login / §80 Authentication | Lulus | `identity.test.ts`, `bootstrap.test.ts`, `browser/identity.spec.ts`: login benar/salah, logout, akun nonaktif, perubahan role, sesi, hak Admin, Origin dan pembatasan login |
| §79 Proyek / §80 Project | Lulus | `projects.test.ts`, `browser/projects.spec.ts`: CRUD, tanggal/nilai, tim, pencabutan akses, status, arsip dan persistensi |
| §79 Daftar Pekerjaan / §80 Work Item | Lulus | `work-calculation.test.ts`, `work-items.test.ts`, `browser/work-items.spec.ts`: angka presisi, hierarki, bobot, pembagi nol, basis terkunci dan otorisasi |
| Pekerjaan dari workbook TS | Lulus backend/sumber dan browser desktop/HP | Semua 45 uraian dibandingkan dengan TS; 7 kelompok/38 item, basis M1, pembulatan, parent, audit serta impor bersamaan diuji. `browser/workbook-import.spec.ts` memeriksa pratinjau, persistensi setelah reload dan tampilan HP |
| §79 Rencana / §80 Planning | Lulus | `plans-calculation.test.ts`, `plans.test.ts`, `browser/plans.spec.ts`: baseline, target mingguan/bulanan, revisi, tanggal berlaku, snapshot, konkurensi dan versi lama |
| §79 Laporan Harian / §80 Daily Report | Lulus | `reports.test.ts`, `browser/reports.spec.ts`: kegiatan, pekerja, cuaca, material/alat, masalah, foto, create/edit/submit, validasi, akses dan persistensi |
| §79 Pemeriksaan | Lulus | `reports.test.ts`, `browser/reviews.spec.ts`, `browser/acceptance.spec.ts`: catatan Engineer, penolakan approval Engineer/Admin, perbaikan beralasan, TL approval, koreksi dan histori |
| §79 Progress / §80 Progress | Lulus | `progress-calculation.test.ts`, `reports.test.ts`: kuantitas, fisik, bobot, partisi sebelumnya/berjalan/kumulatif, deviasi, hanya sumber sah, idempotensi dan approval serentak |
| §79 Grafik | Lulus | `reports.test.ts`, `browser/progress.spec.ts`: baseline/pembanding/aktual satu sumber, tanggal cut-off, revisi tidak mengubah aktual, galeri dan riwayat berotorisasi |
| §79 Laporan / §80 Reporting | Lulus | `reports.test.ts`, `exports.test.ts`, `workbook-layout.test.ts`, `browser/progress.spec.ts`: mingguan/bulanan, delapan output web/PDF/XLSX, angka, foto/grafik, periode kosong dan banyak baris |
| §81 Skenario lintas role | Lulus terarah desktop dan HP | `browser/acceptance.spec.ts`: Admin membuat empat akun baru lewat UI; TL membuat proyek/pekerjaan/rencana dan tim teknis; Admin menugaskan Owner; Inspector mengisi laporan lengkap/foto; Engineer mencatat; TL meminta perbaikan lalu menyetujui; Owner membaca monitoring |
| §81 Cabang revisi/koreksi/akses | Lulus terarah desktop dan HP | Tes yang sama membuktikan aktual 25% tetap saat rencana direvisi dan koreksi masih pending, kemudian menjadi 20% saat koreksi disetujui; versi/foto lama tetap terbaca, proyek dan ekspor ditolak bagi pengguna tanpa penugasan |
| §82 Frontend/backend/database/authorization/validation | Lulus | Jalur API menggunakan PostgreSQL nyata; perhitungan pada service bersama, UI membaca API; schema/input/upload dan role/proyek divalidasi di backend |
| §82 Loading/empty/error | Lulus pada tes komponen/alur browser | `home`, `identity`, `projects`, `plans`, `reports`, `progress` memeriksa keadaan kosong/gagal dan pemulihan; tombol dan pesan Indonesia; loading state tersedia pada pemuatan dan mutasi |
| §82 Tes kritis/TypeScript/build | Lulus | 74/74 tes domain/API/format/sumber; `npm.cmd run build` mencakup typecheck frontend/backend/tes dan salin aset. Linter tidak dikonfigurasi sehingga tidak diklaim dijalankan |
| §82 Console/layout/workflow | Lulus; 10/10 regresi terkait setelah perbaikan | Skenario T11 menangkap pageerror dan console error JavaScript, memeriksa overflow serta screenshot Owner; percobaan 403/404 yang disengaja tidak dianggap cacat runtime |
| Instalasi schema kosong/bootstrap/restart/foto | Lulus | `test:smoke`: migration dan bootstrap CLI pada schema PostgreSQL baru, restart development/build, data dan foto tetap tersedia, berkas privat terlindungi |

Tes otomatis memakai schema PostgreSQL acak dan foto sementara. Bootstrap serta seed runner memakai service aplikasi; perubahan bisnis skenario utama dilakukan melalui UI, tanpa SQL manual. Pemeriksaan API pada skenario utama hanya membaca hasil dan mencoba approval terlarang. Tes integrasi terpisah boleh membentuk kondisi kegagalan/konkurensi secara terkontrol pada schema tes.

## Data workbook dan kesamaan layout

Workbook tersedia dan diperiksa: `LAPORAN PROYEK contoh.xlsx`, SHA-256 `d8861acf3d676d1eea97d9d2ddf60b151d0399d881818859075dbf1d75ffa51e`. Template H0/M1/B1/TS digunakan pada pratinjau, PDF dan Excel. Tes memeriksa kolom, tinggi baris, merge, angka, print setup, logo, halaman lanjutan dan sumber pekerjaan TS. Pemeriksaan visual sintetis T10 tercatat di progres; ini bukan klaim perbandingan setiap piksel dengan Microsoft Excel.

Pekerjaan demo manual berasal dari workbook melalui impor yang dikonfirmasi pengguna. Nilai volume `622.1201983` dibulatkan menjadi `622.120198`; seluruh bobot dihitung ulang. Batas minggu pertama di workbook berbeda dari aturan aplikasi, sehingga target/aktual cache dan formula eksternal tidak diperlakukan sebagai realisasi atau rencana aplikasi. Data sintetis pada tes deterministik tidak otomatis dimasukkan ke proyek pengguna.

## Masalah yang ditemukan dan ditangani

- Percobaan awal skenario T11 habis waktu karena memilih Owner dari daftar penugasan TL. Pembatasan aplikasi memang mengharuskan Administrator menugaskan Owner. Skenario diperbaiki tanpa memperluas hak TL. Dua tes terarah kemudian lulus.
- Label pilihan pekerjaan pada skenario disesuaikan dengan tampilan sebenarnya, dan percobaan akses proyek tersembunyi memeriksa 404 untuk menjaga kerahasiaan keberadaan proyek.
- Regresi lengkap pertama menghasilkan 46/48 lulus. Dua kegagalan tes pemeriksaan disebabkan pemilihan akun pertama berdasarkan role; akun baru yang dibuat T11 mengubah urutan kandidat. Tes kini memilih nama akun fixture yang tepat, tanpa perubahan hak aplikasi. Pengulangan terkait menjalankan skenario pembuat akun terlebih dahulu untuk memeriksa penyebab yang sama: 10/10 lulus pada desktop dan HP.
- Pemeriksaan visual angka pekerjaan TS menemukan nilai besar terbungkus pada digit terakhir. Ukuran teks ringkasan diperbaiki, screenshot desktop diperiksa ulang, dan tes work-items/import desktop serta HP lulus. Tidak ada cacat kritis yang diketahui belum ditangani pada cakupan validasi ini.

## Batas yang tetap berlaku

| Batas | Dampak |
| --- | --- |
| Prototype lokal; belum uji beban atau deployment production | Belum menyatakan kapasitas, availability atau kesiapan production |
| Restart yang diuji adalah backend/koneksi, schema kosong pada PostgreSQL yang sudah berjalan | Tidak mengklaim pengujian mati listrik, restart OS, instalasi PostgreSQL dari nol atau disaster recovery |
| Impor khusus workbook ini ke daftar kosong | Tidak menggabungkan data lama, tidak membuka basis terkunci, bukan parser Excel umum |
| Formulir PDF gambar resolusi tinggi; rincian teks pada lampiran | Font dan pemenggalan teks tidak dijamin sama persis dengan Excel; lampiran menjaga data yang tidak muat |
| Logo default berasal dari workbook contoh | Pengguna harus mematikan logo bila identitas instansi/perusahaan tidak sesuai |
| PPN, pembulatan, tanda tangan/pengesahan belum dikonfigurasi | Tidak dihitung/diisi seolah sudah disahkan |
| Basis kontrak dikunci setelah baseline; target versi baru tidak mengubah aktual | Perubahan lingkup kontrak membutuhkan desain versi basis tersendiri |
| Dua advisory moderat dependency ExcelJS/UUID dari pemeriksaan T10 | Temuan tetap terbuka sesuai `docs/ekspor.md`; jalur yang dipakai v4, bukan API buffer terdampak. Belum audit production baru |
| Galeri/riwayat dan ekspor belum diuji pada skala sangat besar | Belum menjanjikan performa di luar batas prototype |

Cara mengulang tersedia pada [panduan demo](demo-guide.md). Tidak ada perubahan migration 001–008, reset database utama, atau pengubahan history untuk menutup T11.

## Perbaikan setelah T11: Nama kontraktor

Kolom kontraktor ditambahkan pada proyek, laporan dan ekspor melalui migration 009, dengan default kosong untuk data lama. Pengujian baru membuktikan upgrade tidak mengubah data/history sebelumnya. Regresi awal 74/75 lulus; fixture schema historis diperbaiki dan pengulangan upgrade/ekspor 2/2 lulus. Browser terkait 18/18 desktop/HP, build/typecheck dan smoke lulus. Rincian ada pada entri perbaikan di progress. Identitas kontraktor mengikuti proyek saat ini, terpisah dari histori volume/persetujuan. Ini menyelesaikan kekurangan form yang ditemukan pengguna setelah penerimaan T11.
