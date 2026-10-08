# Ekspor prototype SIMP

Buka **Proyek → pilih proyek → Ekspor PDF dan Excel**. Pilih jenis laporan, isi pilihan periode, tekan **Tampilkan Pratinjau**, lalu **Unduh PDF** atau **Unduh Excel**. Unduhan memakai pilihan terakhir yang berhasil dipratinjau. Mengubah formulir saja belum mengubah pilihan unduhan.

| Jenis | Isi utama |
| --- | --- |
| Harian | Satu revisi laporan, kegiatan, cuaca, tenaga kerja, material, masalah, pemeriksaan dan foto |
| Mingguan | Periode menurut aturan minggu versi rencana (versi baru Senin–Minggu), progress sebelumnya/periode ini/kumulatif dan rincian sumber sah |
| Bulanan | Periode bulan proyek sejak tanggal mulai, termasuk periode terakhir yang pendek |
| Rekap progress | Basis pekerjaan, aktual/target/deviasi dan sumber kegiatan |
| Grafik rencana dan aktual | Rencana Awal, pembanding, aktual sampai cut-off, serta tabel angka grafik |
| Tenaga kerja | Rincian, orang-hari dan orang-jam per kategori/jabatan |
| Material dan alat | Rincian penerimaan/penolakan, alasan, rekap per nama dan satuan |
| Masalah lapangan | Catatan masalah, lokasi, dampak, penyelesaian dan status |

Web, PDF dan XLSX memakai `ExportDocument` yang sama dari service ekspor. Perhitungan progress tetap memakai service T07/T08/T09. Metadata mencakup proyek, periode/cut-off, versi rencana, waktu pembuatan dan identitas sumber. Unduhan merupakan pembacaan baru: koreksi atau persetujuan di antara pratinjau dan unduhan bisa mengubah hasil. File yang sudah diunduh tidak diubah oleh aplikasi.

Hak akses tetap diperiksa backend pada setiap permintaan. Owner hanya boleh mengekspor laporan harian disetujui. Inspector hanya mendapat rincian laporan miliknya; total progress proyek tetap dapat dibaca sesuai penugasan. Draf dapat diekspor oleh pihak yang berhak membacanya, tetapi diberi keterangan belum menjadi progress resmi. Rekap memakai revisi sah yang masih berlaku. Foto diunduh melalui pemeriksaan akses dalam transaksi yang sama. Tidak ada tautan publik ke penyimpanan foto.

Orang-hari menjumlahkan jumlah orang yang tercatat per laporan; orang-jam menjumlahkan jumlah orang × jam kerja. Keduanya bukan hitungan orang unik. Orang yang dicatat dalam beberapa laporan bisa terhitung berulang. Material diterima dan ditolak dipisahkan, demikian juga satuan berbeda. Catatan masalah tidak dianggap sebagai daftar masalah unik lintas laporan.

Formulir utama kini mengikuti geometri workbook: H0 untuk harian/rekap bagian harian, M1 untuk mingguan/progress, B1 untuk bulanan, dan TS untuk grafik. Kop, kelompok kolom, warna, border, lebar kolom, tinggi baris, orientasi A4, margin dan header cetak disalin dari template yang sudah dibersihkan. Data aplikasi mengisi sel yang dipetakan; data contoh dan formula eksternal tidak disalin. PDF mencetak formulir tersebut terlebih dahulu, kemudian lampiran A3 mendatar dengan font Noto Sans dan teks lengkap. XLSX dibuat dengan ExcelJS, berisi sel angka nyata, filter/header beku, judul cetak berulang dan lembar gambar grafik beserta data sumbernya. Grafik Excel berupa gambar, bukan objek grafik Excel yang dapat diedit; data angkanya tetap tersedia. Foto harian disertakan dalam kedua format.

Angka di web/PDF memakai pemisah Indonesia. Format tampilan angka Excel mengikuti pengaturan regional aplikasi spreadsheet. Excel membatasi presisi angka; lembar **Nilai Eksak** menyimpan semua angka sumber sebagai teks tanpa pembulatan. Teks pengguna ditulis sebagai string biasa, termasuk teks yang diawali `=`, bukan sebagai formula. Isi teks yang sangat panjang tetap tersimpan dalam sel; bila tinggi baris Excel mencapai batasnya, baca melalui bilah formula atau PDF. Prototype belum memakai antrean ekspor atau uji beban dokumen sangat besar.

## Perbandingan workbook contoh

`LAPORAN PROYEK contoh.xlsx` telah dibaca dengan ExcelJS: 13 lembar, yaitu TS, M1–M5, B1, H0–H5. Workbook berisi formula dan penggabungan sel untuk format cetak. Lembar pertama ekspor SIMP kini memakai formulir workbook. Setelahnya tersedia lembar rincian informasi, basis/progress, sumber, tenaga kerja, material, masalah, foto/grafik, dan nilai eksak.

Formula nilai `H20*J20` dan bobot `K20/$K$67*100` pada M1 sejalan dengan konsep nilai/bobot SIMP. M1 memakai referensi tanggal eksternal dan rumus hari `(Q12*7)-3`; B1 mengacu akhir M5. Versi rencana lama mempertahankan minggu tujuh hari sejak awal proyek, sedangkan versi baru mengikuti Senin–Minggu dan periode pertama/terakhir parsial. Bulan tetap dihitung dari tanggal mulai proyek. Referensi `[1]Data!…` tidak tersedia sebagai sumber runtime, dan hasil cache Excel tidak digunakan untuk menghitung data aplikasi.

Permintaan pengguna pada 1 Oktober 2026 menetapkan layout workbook sebagai acuan wajib. Template disimpan sebagai aset struktur/style yang telah dibersihkan, bukan workbook bisnis kedua. Pengujian membandingkan geometri dan style dengan workbook asli serta memastikan data contoh, formula eksternal dan identitas penandatangan tidak bocor.

Isi tetap berasal dari aplikasi: periode mengikuti aturan proyek, bukan tanggal contoh. PPN/pembulatan yang belum dikonfigurasi dikosongkan; total kontrak berasal dari aplikasi dan diberi label. Kolom pengesahan menyediakan ruang tanda tangan, bukan pengesahan otomatis. Logo pada kop workbook ikut disertakan sebagai bawaan. Hapus centang **Gunakan logo dari workbook contoh** apabila instansi/perusahaan berbeda; pratinjau dan unduhan akan menghilangkannya. Nama atau merek yang ada di dalam gambar logo tetap bagian dari gambar sumber. Dokumen yang melebihi kapasitas formulir mendapat halaman/lembar lanjutan. Teks panjang yang tidak muat pada kotak tetap tersedia lengkap di lampiran. PDF memakai gambar formulir beresolusi tinggi, sedangkan lampirannya tetap berisi teks yang dapat dicari; rendering font dapat berbeda dari Microsoft Excel.

## Catatan dependency

Audit npm pada 30 September 2026 melaporkan dua temuan moderat: `exceljs` melalui `uuid`, terkait buffer pada UUID v3/v5/v6. Pemeriksaan source ExcelJS menemukan pemakaian UUID v4 untuk conditional formatting; aplikasi ekspor ini tidak memanggil API rentan tersebut. Tidak dilakukan downgrade besar otomatis. Temuan tetap dicatat untuk peninjauan dependency sebelum production.

Acuan pustaka: [PDFKit](https://pdfkit.org/docs/table.html) dan [ExcelJS](https://github.com/exceljs/exceljs). Font Noto Sans tersedia melalui paket `@fontsource/noto-sans`.


## Pemeliharaan template

Aset `server/templates/workbook-layout.json` diekstrak dengan `node scripts/extract-workbook-layout.mjs`. Script hanya mempertahankan label yang diizinkan, geometri dan style; nilai bisnis contoh, formula, cache dan nama penandatangan dibuang. Gambar logo dalam area kop cetak dipertahankan; gambar contoh di luar area tersebut tidak dimasukkan. Hash workbook sumber ikut dicatat. Build menyalin aset ke dist. Perubahan workbook perlu peninjauan pemetaan sel, pengujian layout, dan pemeriksaan visual sebelum digunakan.
