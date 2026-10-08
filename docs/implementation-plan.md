# Rencana implementasi prototype SIMP

Acuan: [PRD](../prd.md), [analisis](prd-analysis.md), [catatan progres](progress.md), dan [skill](../skills/simp-prototype/SKILL.md).

Status: T00–T11 selesai dan tervalidasi: PostgreSQL, login/pengguna, proyek/tim, pekerjaan/bobot, rencana terversi, laporan harian, foto privat, pemeriksaan Engineer, keputusan TL, koreksi terversi, progress resmi, laporan berkala, ringkasan role, grafik, galeri berfilter, riwayat, delapan keluaran web/PDF/XLSX, rekap dan filter laporan. T07–T11 tidak menambah migration; 001–008 beserta history tetap utuh. T11 menambahkan verifikasi lintas role, impor pekerjaan TS, [panduan demo](demo-guide.md) dan [hasil penerimaan](acceptance-results.md). Bukti validasi tercatat di [progress](progress.md). Seluruh P0–P3 dan demo end-to-end telah divalidasi dalam batas prototype; langkah berikutnya adalah demo pengguna dan umpan balik, bukan deployment production otomatis.

## Cara menjalankan

Perbaikan setelah penutupan T11: nama kontraktor ditambahkan ke identitas proyek, laporan dan ekspor melalui migration 009. Bukti validasi lanjutan tercatat di progress; data dan migration 001–008 dipertahankan.

Gunakan skill untuk satu tahap atau seluruh rangkaian. Tahap selesai hanya ketika keluarannya ada dan kriteria lulus dibuktikan. Jangan berhenti untuk meminta persetujuan rutin setiap tahap jika pengguna sudah meminta seluruh implementasi. Jika diminta hanya perencanaan, jangan mulai coding aplikasi.

Contoh permintaan setelah skill tersedia:

```text
Gunakan $simp-prototype. Kerjakan T00 sesuai docs/implementation-plan.md,
validasi hasilnya, lalu perbarui docs/progress.md.

Gunakan $simp-prototype. Lanjutkan tahap berikutnya yang belum selesai.

Gunakan $simp-prototype. Implementasikan seluruh rencana sampai T11,
jalankan pengujian setiap tahap, dan simpan titik lanjut bila sesi berakhir.
```

Jika nama skill belum tersedia di sesi, sebut langsung `skills/simp-prototype/SKILL.md` sebagai instruksi kerja. Format skill mengikuti [dokumentasi resmi](https://learn.chatgpt.com/docs/build-skills).

## Urutan dan dependensi

| Tahap | Prioritas | Hasil | Bergantung pada | Pemetaan STEP PRD §83 |
| --- | --- | --- | --- | --- |
| T00 | Fondasi | Inventaris, keputusan teknis, aplikasi dan DB dapat berjalan | — | 1–2 |
| T01 | P0 | Login, role, pengguna | T00 | 3–4 |
| T02 | P0 | Proyek dan tim dengan pembatasan akses | T01 | 5–6 |
| T03 | P0 | Pekerjaan bertingkat dan bobot | T02 | 7–8 |
| T04 | P1 | Rencana awal, periode, dan revisi | T03 | 9–10 |
| T05 | P1 | Laporan harian lengkap dan foto | T04 | 11, bagian 18 |
| T06 | P1 | Pemeriksaan, persetujuan, koreksi terversi | T05 | 12 |
| T07 | P2 | Progress resmi yang konsisten | T06 | 13 |
| T08 | P2 | Laporan mingguan dan bulanan | T07 | 14–15 |
| T09 | P2/P3 | Ringkasan role, grafik, galeri, riwayat | T08 | 16–18 |
| T10 | P3 | PDF, Excel, rekap, pencarian dan saringan lengkap | T09 | 19 |
| T11 | Penutupan | Tes end-to-end, perbaikan, paket demo | T10 | 20 |

Tes unit/integrasi dibuat saat fitur terkait dikerjakan. T11 adalah verifikasi menyeluruh, bukan awal menulis tes. Upload foto dibangun pada T05 karena merupakan bagian laporan; galeri lintas laporan diselesaikan T09. Fondasi audit dibuat awal dan dipakai sepanjang tahapan.

## T00 — Fondasi dan keputusan teknis

**Cakupan:** PRD §41–54, §65–70, §78, §84, §86.

- Inspeksi ulang repository sebelum scaffold; kondisi mungkin berubah setelah rencana ini ditulis.
- Catat stack, struktur modul, runtime, database, strategi sesi login, penyimpanan foto, serta perintah dev/build/typecheck/test dalam `docs/architecture.md`.
- Pilih solusi paling kecil yang memenuhi TypeScript, pemisahan frontend/backend, migration, transaksi, dan persistensi. Framework serta versi dikunci setelah diverifikasi; jangan scaffold dua frontend atau dua backend.
- Rekam asumsi analisis/domain dalam `docs/decisions.md`, termasuk periode bulanan, bobot/basis, koreksi laporan, granularitas rencana, dan zona waktu. Gunakan asumsi awal jika belum ada arahan lain.
- Siapkan aplikasi minimal, konfigurasi environment contoh tanpa rahasia, koneksi DB, migration awal identitas/proyek, penanganan error, dan kerangka tes service/API.
- Rancang relasi modul berikutnya; migration detail dikerjakan pada tahap pemiliknya. Siapkan bootstrap Administrator dari konfigurasi lokal dengan password di-hash.

**Kriteria lulus:** instalasi/development/build bekerja; koneksi dan migration berhasil pada DB kosong; data uji tetap ada setelah restart; tes dasar koneksi atau endpoint berjalan; perintah aktual tercatat. Jangan menggunakan mock DB sebagai bukti persistensi.

## T01 — Login, role, dan pengguna

**Cakupan:** §4, §5, §7, §58, §78–80.

- Login/logout, sesi tervalidasi backend, lima role, penolakan akun nonaktif, dan navigasi sesuai role.
- Administrator dapat membuat/mengubah pengguna, mengganti role, mengaktifkan/nonaktifkan. UI perubahan data sensitif memiliki validasi yang jelas.
- Hash password melalui mekanisme standar stack; jangan percaya role dalam payload browser. Terapkan fungsi authorization yang bisa dipakai setiap modul.
- Siapkan komponen UI bersama Bahasa Indonesia: tombol, input, feedback, keadaan memuat/kosong/error, dan layout responsif.

**Kriteria lulus:** tes login benar/salah, logout membuat sesi tidak bisa digunakan, akun nonaktif ditolak, akses API terlindungi tanpa login ditolak, dan non-Admin gagal mengelola akun walau memanggil API langsung. Perubahan role/penonaktifan memengaruhi sesi yang sedang aktif sesuai kebijakan tercatat.

## T02 — Proyek dan tim

**Cakupan:** §8–10, §38, §43, §58–59, §77.

- CRUD proyek berisi seluruh informasi §8, termasuk kontrak awal/berjalan, instansi/alamat, konsultan, tanggal, durasi, status, dan keterangan.
- Status awal/berjalan/terlambat/selesai/ditutup dengan aturan faktual; simpan override Admin/TL berikut alasan. Sampai progress tersedia, gunakan data tanggal dan tampilkan keterbatasan status hitungan.
- Penugasan Owner/TL/Engineer/Inspector, periode aktif, dan satu pengguna di beberapa proyek; pembuat TL memperoleh penugasan ke proyek baru.
- Terapkan pembatasan backend berdasarkan proyek dan penugasan; Admin dapat melihat seluruh proyek. Daftar pengguna bagi Owner/TL sebatas direktori yang diperlukan proyek.
- Daftar/detail proyek, pencarian awal, serta konfirmasi penghapusan. Lindungi proyek yang memiliki relasi historis; tawarkan tutup/arsip sesuai kebutuhan, tanpa cascade menghilangkan laporan.

**Kriteria lulus:** CRUD dan persistensi proyek; tanggal terbalik/nilai negatif ditolak; durasi benar; penugasan bekerja; akun di proyek A tidak bisa membaca/mengubah data proyek B melalui manipulasi ID; Owner tidak dapat mengubah teknis proyek.

## T03 — Daftar pekerjaan dan bobot

**Cakupan:** §11–13, §44, §59, §69.

- Pekerjaan bertingkat dengan kode, nama, kelompok, satuan, volume, harga, nilai, bobot, tanggal dan keterangan.
- Service nilai/bobot hanya menghitung daun; induk menampilkan agregat. Validasi parent lintas proyek, siklus, nilai negatif, dan penghapusan item yang dirujuk.
- Gunakan presisi angka yang terdokumentasi dan peringatan total bobot. Tampilan nominal/persen memakai format Indonesia.
- Siapkan aturan pembekuan basis yang akan diaktifkan setelah baseline terbit pada T04.

**Kriteria lulus:** tes nilai/bobot/total mendekati 100, pembulatan, total nilai nol, volume nol, struktur bertingkat dan parent ganda/siklus; perubahan tersimpan di DB dan tidak merusak proyek lain. Unit test tidak hanya mengulang kode implementasi, tetapi memakai angka pembanding yang diketahui.

## T04 — Periode dan rencana terversi

**Cakupan:** §14–18, §33–34, §45–46, §59, §70–72.

- Service periode dari tanggal mulai proyek: hari, minggu, bulan, sisa hari, dan periode terakhir parsial.
- Editor target per pekerjaan mingguan/bulanan dengan granularitas sumber yang jelas; target kumulatif dan bobot konsisten.
- Terbitkan Rencana Awal. Buat revisi sebagai versi baru dengan alasan, effective date, pembuat, dan rincian perubahan.
- Histori/perbandingan versi, pemilihan rencana berlaku per tanggal, dan versi masa depan yang belum aktif. Pisahkan identitas baseline dari status aktif.
- Bekukan basis volume/harga/bobot sesuai keputusan prototype; perubahan jadwal/tanggal selesai tercatat tanpa merusak snapshot periode sebelumnya.

**Kriteria lulus:** tes tanggal mulai 16 Juli, pergantian bulan/tahun/kabisat, tanggal akhir; target mingguan dan bulanan selaras; nomor versi unik; hanya satu versi berlaku pada tanggal tertentu; baseline tetap tersedia; rencana masa depan tidak aktif terlalu awal; uji yang membuktikan revisi tidak mengubah sumber aktual disiapkan lalu diulang dengan workflow nyata pada T07.

## T05 — Laporan harian dan dokumentasi lapangan

**Cakupan:** §19–25, §47–53, §59, §73–75.

- Form per bagian: identitas otomatis, kegiatan, tenaga kerja per jenis/jam/identitas opsional, cuaca per waktu, material/alat diterima/ditolak, masalah, foto, dan catatan umum.
- Hubungkan kegiatan ke pekerjaan proyek, satuan dan tanggal yang valid. Aktivitas naratif boleh tanpa volume; hanya aktivitas kuantitatif sah menjadi sumber progress.
- Simpan sementara, ubah milik sendiri, ringkasan sebelum kirim, validasi kegiatan wajib dan alasan material ditolak. Tetapkan aturan pekerjaan yang mensyaratkan foto secara sederhana.
- Foto tersimpan di storage dan metadata DB, terkait laporan/kegiatan/pekerjaan. Batasi tipe/ukuran dan cek konten file; akses file mengikuti akses laporan.
- Buat tampilan detail laporan dan dokumentasi pekerjaan. Simpan audit perubahan penting sejak tahap ini.

**Kriteria lulus:** laporan lengkap dapat disimpan, dibuka ulang dan diedit tanpa kehilangan child data; form kosong/tenaga kerja negatif/material ditolak tanpa alasan gagal; malam boleh kosong; file tidak valid gagal; foto bisa dibuka ulang oleh pihak berhak; Inspector lain tidak dapat mengubah laporan milik orang lain.

## T06 — Pemeriksaan, persetujuan, dan koreksi

**Cakupan:** §26–27, §40, §55, §58, §60.

- Implementasikan state machine empat status Bahasa Indonesia serta daftar laporan menunggu pemeriksaan.
- Engineer menambahkan catatan/hasil pemeriksaan teknis; Team Leader proyek menyetujui atau meminta perbaikan dengan alasan wajib.
- Laporan menunggu pemeriksaan dan yang disetujui dikunci dari edit biasa. Revisi laporan sah membuat versi turunan, dengan persetujuan ulang dan histori versi lama.
- Siapkan transaksi dan idempotensi persetujuan; sumber kontribusi yang sah dipilih secara eksplisit untuk T07.
- Owner hanya menerima data laporan disetujui; foto dan ringkasan turunannya mengikuti filter ini.

**Kriteria lulus:** transisi valid berhasil dan transisi ilegal ditolak backend; Admin/Engineer/Inspector tidak bisa approval; Team Leader proyek lain ditolak; alasan perbaikan wajib; versi lama tetap terbaca setelah koreksi; uji klik ganda/permintaan bersamaan tidak membuat dua keputusan atau kontribusi.

## T07 — Progress aktual

**Status: selesai, 30 September 2026.** Validasi: 64 tes backend, 38 tes browser, build dan smoke restart lulus. Bukti rinci di `docs/progress.md`.

**Cakupan:** §28–29, §32, §34, §54–55, §68–72.

- Implementasikan satu ProgressService dari kontribusi aktivitas disetujui: volume, fisik, tertimbang, sebelumnya/berjalan/kumulatif, total dan selisih.
- Gunakan basis perhitungan yang tetap; materialisasi `progress_records` jika diperlukan harus dapat dibangun kembali dari sumber sah.
- Koreksi yang disetujui mengganti kontribusi revisi sebelumnya secara atomik. Approval terlambat mengikuti tanggal kegiatan dan menghasilkan jejak perubahan.
- Sediakan API progress per pekerjaan/proyek/cutoff/versi rencana, serta rincian asal angka yang bisa diperiksa.

**Kriteria lulus:** contoh 250/1.000 dengan bobot 10 menghasilkan 2,5%; laporan belum sah tidak dihitung; persetujuan ganda tidak menggandakan; koreksi 250→200 menghasilkan 2%; sebelumnya+berjalan=kumulatif; revisi rencana menjaga seluruh aktual lama tetap identik. Uji pembagi nol, batas volume, dan dua approval bersamaan pada item sama.

## T08 — Laporan mingguan dan bulanan

**Status: selesai, 30 September 2026.** Validasi: 66 tes backend, 40 tes browser, build/typecheck dan smoke restart lulus; dua tes T08 diulang lulus setelah pemeriksaan akhir. Bukti di `docs/progress.md`.

**Cakupan:** §30–31, §35–36, §61–62.

- Laporan web berdasarkan periode proyek dan database, memenuhi seluruh kolom mingguan/bulanan dalam PRD.
- Sertakan identitas proyek/kontrak, nilai, satuan, volume, bobot, fisik dan tertimbang sebelumnya/berjalan/kumulatif, target, selisih, total dan keterangan.
- Pilihan periode/versi rencana, empty state sebelum ada data, dan identitas pengesahan bila diperlukan.
- Agregasi tidak menyimpan salinan bisnis yang bisa diedit sendiri. Data laporan memakai service yang sama dengan T07.

**Kriteria lulus:** laporan lintas minggu/bulan cocok dengan aktivitas sah pada tanggal batas; tidak menjumlah kumulatif ganda; bulan parsial benar; periode kosong tidak error; angka laporan sama dengan API progress; akses sesuai role/proyek.

## T09 — Ringkasan, grafik, galeri, dan riwayat

**Status: selesai, 30 September 2026.** Validasi: 68 tes backend, 42 tes browser, build dan smoke restart lulus; dua tes backend T09 dan enam browser terkait diulang lulus setelah perbaikan akhir. Bukti di `docs/progress.md`.

**Cakupan:** §32–33, §37–40, §73, §76–77.

- Ringkasan khusus lima role sesuai §38: kartu target/aktual/selisih/hari/sisa hari/nilai kontrak, antrean pemeriksaan, masalah, pekerjaan berjalan, dan foto terbaru sesuai hak akses.
- Grafik tiga seri: Rencana Awal, Rencana Terbaru, Progress Aktual; label periode/persen dan versi yang jelas. Tidak memberi label Bagus/Buruk/Aman/Gagal.
- Galeri dengan filter proyek/tanggal/pekerjaan/laporan/pengunggah, terhubung ke detail sumber.
- Halaman riwayat data, rencana, laporan, persetujuan dan koreksi; status proyek kini memakai progress yang sebenarnya.

**Kriteria lulus:** setiap role mendapat ringkasan sesuai hak; grafik/angka laporan konsisten; rencana/data kosong tidak crash; pergantian versi tidak mengubah aktual; Owner tidak melihat foto atau catatan dari laporan belum sah; pemeriksaan desktop dan HP dilakukan dengan bukti singkat.

## T10 — Ekspor dan penyelesaian P3

**Cakupan:** §61–62, §64 P3, §77.

- Lengkapi delapan output §61: harian, mingguan, bulanan, rekap progress, grafik rencana/aktual, tenaga kerja, material/alat, dan masalah lapangan.
- Sediakan web, PDF, dan Excel; grafik dapat disertakan dalam laporan monitoring. Excel menggunakan angka numerik dan data sumber grafik; bukan file HTML/CSV yang hanya diganti ekstensi.
- Pakai DTO/data service yang sama untuk web/PDF/Excel. Sertakan proyek, periode, versi, cutoff dan waktu dibuat; format Indonesia, header tabel berulang, serta halaman lebar yang tetap terbaca.
- Rekap tenaga kerja membedakan orang-hari/orang-jam dari jumlah orang unik; rekap material memisahkan diterima/ditolak beserta satuan dan alasan.
- Lengkapi pencarian proyek (nama/kode/kontrak/lokasi/status) dan filter laporan (proyek/tanggal/minggu/bulan/status/pembuat). Foto memakai filter T09.
- Uji akses unduhan dan penanganan teks pengguna agar tidak dieksekusi sebagai formula spreadsheet.

**Kriteria lulus:** PDF/Excel valid dan dapat dibuka; isi/angka/periode cocok dengan tampilan web; ekspor kosong/banyak baris terformat; gambar/grafik terbaca; role tanpa hak unduh ditolak API; semua delapan output tersedia. Jika workbook belum ada, jangan mengklaim template identik.

## T11 — Validasi akhir dan paket demo

**Cakupan:** §79–82, §86–88 dan seluruh kriteria tahap sebelumnya.

- Jalankan skenario §81 melalui aplikasi: Administrator membuat pengguna → TL membuat proyek/pekerjaan/rencana/tim → Inspector melaporkan kegiatan lengkap dan foto → TL menyetujui → progress/laporan/grafik terbentuk → Owner memonitor.
- Tambahkan cabang minta perbaikan, revisi rencana, koreksi laporan sah, dan percobaan akses proyek yang tidak ditugaskan. Engineer harus bisa memberi catatan tetapi gagal approval.
- Gunakan seed hanya untuk bootstrap dan demo opsional; skenario utama tidak ditopang edit SQL manual atau data hardcode UI.
- Jalankan tes domain/integrasi/end-to-end, typecheck, build, dan lint bila tersedia. Periksa critical console error, bahasa UI, serta layout komputer/HP.
- Uji menjalankan dari database kosong, migration, bootstrap, dan restart dengan persistensi data/foto.
- Buat `docs/demo-guide.md` berisi setup, environment contoh, perintah sebenarnya, cara membuat akun demo, skenario demo, keterbatasan prototype, dan cara melanjutkan pengembangan. Rahasia tidak ditulis ke panduan.
- Buat `docs/acceptance-results.md`: setiap kelompok §79–82, status dan bukti; daftar masalah tersisa dengan dampak yang jujur.

**Kriteria lulus akhir:** semua P0–P3 berjalan, skenario lintas role lulus tanpa manipulasi database manual, tes kritis/typecheck/build lulus, tidak ada cacat kritis yang belum ditangani, data/foto bertahan setelah restart, serta demo dapat diulangi dari petunjuk. Kesesuaian layout workbook tetap diberi status belum diverifikasi jika file sumber belum tersedia; ini tidak disamarkan sebagai keberhasilan.

## Aturan penutupan setiap tahap

Periksa database, backend/service, authorization, validasi, UI Bahasa Indonesia, seluruh feedback yang relevan, dan tes kritis. Catat bukti dan keterbatasan pada progress sebelum mengganti status menjadi selesai. Bila hambatan eksternal muncul, kerjakan bagian independen yang masih dapat dikerjakan, simpan langkah reproduksi, dan jangan memberi tanda selesai pada bagian yang belum terbukti.
