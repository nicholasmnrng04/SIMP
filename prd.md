# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## SISTEM INFORMASI MONITORING PROYEK (SIMP)

**Versi:** 2.0
**Status:** Prototype / MVP
**Platform:** Web Application
**Bahasa antarmuka:** Bahasa Indonesia
**Target pengguna:** Administrator, Owner, Team Leader, Engineer, Inspector
**Sumber kebutuhan utama:** Analisis file `LAPORAN PROYEK contoh.xlsx`

---

# 1. TUJUAN DOKUMEN

Dokumen ini menjadi acuan utama pengembangan Sistem Informasi Monitoring Proyek (SIMP).

Sistem dibuat untuk menggantikan proses pengelolaan data proyek yang saat ini sangat bergantung pada file Excel, terutama:

* Time Schedule
* Laporan Harian
* Laporan Mingguan
* Laporan Bulanan
* Perhitungan progress
* Perhitungan bobot pekerjaan
* Perbandingan rencana dan realisasi
* Rekap tenaga kerja
* Rekap material dan alat
* Catatan masalah lapangan
* Dokumentasi proyek

Sistem harus menggunakan database sebagai sumber data utama.

Excel hanya digunakan sebagai:

1. Referensi struktur laporan.
2. Referensi format laporan.
3. Referensi rumus/perhitungan.
4. Output laporan jika diperlukan.

Excel TIDAK boleh menjadi database runtime aplikasi.

---

# 2. MASALAH YANG INGIN DISELESAIKAN

Berdasarkan struktur laporan proyek yang dianalisis, data proyek terdiri dari banyak bagian yang saling berhubungan.

Contohnya:

```text
Data Proyek
    ↓
Daftar Pekerjaan
    ↓
Rencana / Time Schedule
    ↓
Laporan Harian
    ↓
Progress Aktual
    ↓
Laporan Mingguan
    ↓
Laporan Bulanan
    ↓
Monitoring Rencana vs Aktual
```

Masalah utama yang harus diselesaikan:

1. Data proyek tidak boleh tersebar tanpa hubungan yang jelas.
2. Data pekerjaan tidak boleh diinput berulang pada setiap laporan.
3. Progress tidak boleh dihitung manual berulang kali.
4. Laporan harian harus menjadi sumber informasi kegiatan lapangan.
5. Laporan mingguan dan bulanan harus dapat mengambil data dari database.
6. Perubahan rencana proyek harus memiliki riwayat.
7. Progress aktual masa lalu tidak boleh berubah ketika rencana baru dibuat.
8. Pengguna non-teknis harus dapat menggunakan aplikasi tanpa memahami istilah teknis database.
9. Sistem harus menyediakan monitoring yang mudah dipahami.
10. Sistem harus dapat menghasilkan laporan yang mendekati struktur laporan proyek yang sudah digunakan.

---

# 3. PRINSIP UTAMA SISTEM

## 3.1 Satu sumber data

Database menjadi sumber data utama.

Jangan membuat:

```text
Laporan Harian → database sendiri
Laporan Mingguan → database sendiri
Laporan Bulanan → database sendiri
```

Tetapi:

```text
                 ┌── Laporan Harian
                 │
Database Proyek ─┼── Progress Mingguan
                 │
                 ├── Progress Bulanan
                 │
                 ├── Grafik Monitoring
                 │
                 └── Laporan
```

---

# 4. TARGET ROLE

Sistem memiliki 5 role utama.

## 4.1 Administrator

Tanggung jawab:

* Mengelola pengguna.
* Membuat pengguna.
* Mengubah role pengguna.
* Mengaktifkan/nonaktifkan pengguna.
* Mengelola data proyek.
* Melihat seluruh proyek.
* Melihat seluruh laporan.
* Melihat monitoring proyek.

Administrator tidak melakukan persetujuan teknis laporan.

---

## 4.2 Owner

Owner berfungsi sebagai pihak pemilik/pemberi pekerjaan yang membutuhkan informasi monitoring.

Owner dapat:

* Melihat proyek yang dimiliki/ditugaskan.
* Melihat informasi proyek.
* Melihat nilai kontrak.
* Melihat daftar pekerjaan.
* Melihat rencana proyek.
* Melihat progress aktual.
* Melihat progress rencana.
* Melihat selisih progress.
* Melihat grafik rencana dan aktual.
* Melihat laporan harian yang telah disetujui.
* Melihat laporan mingguan.
* Melihat laporan bulanan.
* Melihat dokumentasi proyek.

Owner tidak mengubah data teknis utama proyek.

---

## 4.3 Team Leader

Team Leader adalah pengguna utama untuk pengendalian proyek.

Dapat:

* Membuat proyek.
* Mengubah informasi proyek.
* Membuat daftar pekerjaan.
* Mengatur bobot pekerjaan.
* Membuat rencana proyek.
* Membuat perubahan rencana.
* Menugaskan Engineer.
* Menugaskan Inspector.
* Melihat laporan harian.
* Memeriksa laporan.
* Menyetujui laporan.
* Meminta perbaikan laporan.
* Memantau progress.
* Melihat selisih rencana dan aktual.
* Melihat grafik.
* Menghasilkan laporan.

---

## 4.4 Engineer

Engineer dapat:

* Melihat proyek yang ditugaskan.
* Melihat daftar pekerjaan.
* Melihat rencana proyek.
* Melihat laporan harian.
* Membuat catatan teknis.
* Melihat progress pekerjaan.
* Membantu pemeriksaan teknis.
* Melihat dokumentasi.

Engineer tidak dapat melakukan persetujuan akhir jika bukan Team Leader.

---

## 4.5 Inspector

Inspector berfokus pada data lapangan.

Dapat:

* Melihat proyek yang ditugaskan.
* Membuat laporan harian.
* Mengisi kegiatan pekerjaan.
* Mengisi tenaga kerja.
* Mengisi cuaca.
* Mengisi material dan alat.
* Mengisi masalah lapangan.
* Mengunggah dokumentasi.
* Mengisi hasil pemeriksaan.
* Mengirim laporan untuk diperiksa.

Inspector tidak dapat mengubah data yang sudah disetujui.

---

# 5. ATURAN BAHASA ANTARMUKA

SEMUA teks yang dilihat pengguna harus menggunakan Bahasa Indonesia.

Jangan menggunakan:

* Dashboard
* Project
* Submit
* Approve
* Reject
* Draft
* Attachment
* Evidence
* Progress Report
* Planning
* Revision
* User Management

Gunakan:

| Istilah teknis   | Tampilan              |
| ---------------- | --------------------- |
| Dashboard        | Ringkasan             |
| Project          | Proyek                |
| Project Detail   | Detail Proyek         |
| Planning         | Rencana Proyek        |
| Baseline         | Rencana Awal          |
| Current Plan     | Rencana Terbaru       |
| Revision         | Perubahan Rencana     |
| Actual Progress  | Progress Saat Ini     |
| Planned Progress | Target Progress       |
| Deviation        | Selisih Progress      |
| WBS              | Daftar Pekerjaan      |
| Work Item        | Pekerjaan             |
| Daily Report     | Laporan Harian        |
| Weekly Report    | Laporan Mingguan      |
| Monthly Report   | Laporan Bulanan       |
| Approval         | Persetujuan           |
| Submit           | Kirim untuk Diperiksa |
| Approve          | Setujui               |
| Reject           | Minta Perbaikan       |
| Draft            | Belum Dikirim         |
| Attachment       | Lampiran              |
| Evidence         | Bukti Pekerjaan       |
| History          | Riwayat               |
| User             | Pengguna              |
| Search           | Cari                  |
| Filter           | Saring Data           |
| Save             | Simpan                |
| Cancel           | Batal                 |
| Edit             | Ubah                  |
| Delete           | Hapus                 |
| View             | Lihat                 |

Nama role boleh menggunakan:

* Administrator
* Owner
* Team Leader
* Engineer
* Inspector

tetapi seluruh penjelasan dan menu harus berbahasa Indonesia.

---

# 6. PRINSIP USER EXPERIENCE

Target pengguna tidak semuanya terbiasa menggunakan aplikasi digital.

Karena itu:

> Kompleks di belakang, sederhana di depan.

## Wajib:

* Tombol besar dan jelas.
* Gunakan ikon + teks.
* Jangan menggunakan istilah teknis.
* Form dibagi menjadi beberapa bagian.
* Jangan menampilkan terlalu banyak field sekaligus.
* Gunakan petunjuk pada field.
* Gunakan validasi langsung.
* Tampilkan pesan kesalahan yang mudah dipahami.
* Tampilkan kondisi kosong.
* Tampilkan kondisi memuat data.
* Tampilkan konfirmasi sebelum penghapusan.
* Tampilkan ringkasan sebelum data dikirim.
* Gunakan warna status secara konsisten.
* Tampilan harus nyaman di komputer dan HP.

---

# 7. MODUL SISTEM

Prototype memiliki modul:

1. Login
2. Ringkasan
3. Pengguna
4. Proyek
5. Tim Proyek
6. Daftar Pekerjaan
7. Rencana Proyek
8. Laporan Harian
9. Pemeriksaan
10. Progress
11. Laporan Mingguan
12. Laporan Bulanan
13. Grafik Rencana dan Progress
14. Dokumentasi
15. Riwayat Perubahan

---

# 8. MODUL DATA PROYEK

## 8.1 Informasi proyek

Field:

* Kode proyek
* Nama kegiatan
* Nama pekerjaan
* Lokasi
* Tahun anggaran
* Nomor kontrak
* Tanggal kontrak
* Nilai kontrak awal
* Nilai kontrak berjalan
* Tanggal mulai
* Tanggal selesai
* Durasi pelaksanaan
* Pemberi pekerjaan
* Nama instansi
* Alamat instansi
* Konsultan supervisi
* Team Leader
* Status proyek
* Keterangan

---

# 9. STATUS PROYEK

Gunakan:

* Belum Dimulai
* Berjalan
* Terlambat
* Selesai
* Ditutup

Status dapat dihitung berdasarkan tanggal dan progress, tetapi Team Leader/Administrator dapat melakukan koreksi manual jika diperlukan.

---

# 10. TIM PROYEK

Satu pengguna Engineer atau Inspector dapat ditugaskan ke beberapa proyek.

Struktur:

```text
Pengguna
   ↓
Penugasan Proyek
   ↓
Proyek
```

Data penugasan:

* Pengguna
* Proyek
* Role dalam proyek
* Tanggal mulai penugasan
* Tanggal selesai penugasan
* Status penugasan

---

# 11. MODUL DAFTAR PEKERJAAN

Daftar pekerjaan berasal dari struktur pekerjaan pada laporan proyek.

Contoh:

```text
I. PEKERJAAN PENDAHULUAN
    1. Papan Nama Proyek
    2. Mobilisasi dan Demobilisasi
    3. Direksi Keet
    4. Pembuatan Patok Kayu

II. PEKERJAAN TANAH
    1. Galian Tanah
    2. Timbunan Tanah Kembali

III. PEKERJAAN STRUKTUR
    ...
```

Sistem harus mendukung struktur bertingkat.

---

# 12. DATA PEKERJAAN

Setiap item pekerjaan dapat memiliki:

* Kode pekerjaan
* Nama pekerjaan
* Kelompok pekerjaan
* Uraian
* Satuan
* Volume kontrak
* Harga satuan
* Jumlah harga
* Bobot pekerjaan
* Tanggal mulai
* Tanggal selesai
* Keterangan
* Status

Contoh:

```text
Nama:
Galian Tanah (Mekanis)

Satuan:
M3

Volume:
1130

Harga Satuan:
Rp82.504,02

Jumlah Harga:
Volume × Harga Satuan
```

---

# 13. PERHITUNGAN BOBOT PEKERJAAN

Bobot pekerjaan dihitung berdasarkan nilai pekerjaan.

Formula:

```text
Jumlah Harga = Volume × Harga Satuan
```

Kemudian:

```text
Bobot Pekerjaan =
(Jumlah Harga Item / Total Jumlah Harga Pekerjaan)
× 100
```

Total bobot seluruh pekerjaan harus mendekati:

```text
100%
```

Sistem harus memberikan peringatan apabila total bobot belum 100%.

---

# 14. MODUL RENCANA PROYEK

Modul ini menggantikan Time Schedule Excel.

Rencana dapat dibuat:

* Mingguan
* Berdasarkan tanggal proyek
* Berdasarkan pekerjaan
* Berdasarkan target progress

Periode pertama harus mengikuti tanggal mulai proyek.

Contoh:

Jika proyek mulai:

16 Juli 2026

maka minggu pertama dimulai dari tanggal tersebut.

Jangan memaksa minggu dimulai setiap hari Senin.

---

# 15. RENCANA AWAL

Saat pertama kali membuat rencana:

```text
Rencana Awal
```

disimpan sebagai versi pertama.

Rencana ini tidak boleh dihapus atau ditimpa ketika terjadi perubahan.

---

# 16. PERUBAHAN RENCANA

Kondisi proyek dapat berubah.

Contoh:

* Material terlambat.
* Cuaca.
* Perubahan metode kerja.
* Perubahan urutan pekerjaan.
* Perubahan target.
* Perubahan waktu pelaksanaan.

Karena itu sistem harus menggunakan versi rencana.

Contoh:

```text
Rencana Awal
    ↓
Perubahan Rencana 1
    ↓
Perubahan Rencana 2
    ↓
Rencana Terbaru
```

---

# 17. DATA PERUBAHAN RENCANA

Setiap perubahan harus menyimpan:

* Nomor versi
* Nama versi
* Tanggal berlaku
* Tanggal dibuat
* Dibuat oleh
* Alasan perubahan
* Penjelasan perubahan
* Status
* Daftar pekerjaan yang berubah

Contoh:

```text
Perubahan Rencana 2

Tanggal:
20 September 2026

Alasan:
Keterlambatan pengadaan material

Keterangan:
Pemasangan pipa digeser ke minggu berikutnya.
```

---

# 18. ATURAN PENTING PERUBAHAN RENCANA

DILARANG:

```text
Rencana lama → ditimpa → rencana baru
```

HARUS:

```text
Rencana lama → disimpan
Rencana baru → dibuat sebagai versi baru
```

Progress aktual sebelumnya tidak boleh berubah akibat perubahan rencana.

---

# 19. MODUL LAPORAN HARIAN

Laporan Harian adalah sumber utama informasi aktivitas lapangan.

Form Laporan Harian:

## Informasi laporan

* Nomor laporan
* Proyek
* Tanggal
* Nomor kontrak
* Minggu ke-
* Hari ke-
* Sisa hari
* Durasi proyek

Sistem menghitung otomatis:

```text
Hari ke-
Minggu ke-
Sisa hari
```

berdasarkan tanggal mulai dan selesai proyek.

---

# 20. TENAGA KERJA

Struktur berdasarkan laporan aktual:

## Manajemen

* Manajemen Proyek
* Manager Lapangan
* Staff Administrasi
* Drafter

## Lapangan

* Surveyor
* Operator
* Pelaksana
* Mandor
* Tukang
* Pekerja
* Flagman

Data:

* Jenis tenaga kerja
* Jumlah
* Nomor/identitas jika diperlukan
* Jam kerja
* Keterangan

Jangan menyimpan jumlah tenaga kerja sebagai satu field total saja.

Gunakan struktur:

```text
Laporan Harian
    ↓
Tenaga Kerja
    ├── Manager Lapangan = 1
    ├── Operator = 3
    ├── Pelaksana = 1
    ├── Pekerja = 1
    └── Flagman = 2
```

Total dihitung otomatis.

---

# 21. KEGIATAN HARI INI

Setiap laporan harian dapat memiliki beberapa kegiatan.

Field:

* Pekerjaan
* Uraian kegiatan
* Lokasi
* Volume pekerjaan jika ada
* Satuan
* Keterangan
* Dokumentasi

Kegiatan dapat dikaitkan dengan item pada Daftar Pekerjaan.

Contoh:

```text
Pekerjaan:
Galian Tanah

Kegiatan:
Galian tanah menggunakan excavator pada STA 0+000–0+050.

Volume:
75

Satuan:
M3
```

---

# 22. CUACA

Laporan aktual memiliki kondisi cuaca berdasarkan waktu.

Sistem harus menyediakan:

### Pagi

* Baik
* Gerimis
* Hujan
* Jam mulai
* Jam selesai

### Siang

* Baik
* Gerimis
* Hujan
* Jam mulai
* Jam selesai

### Sore

* Baik
* Gerimis
* Hujan
* Jam mulai
* Jam selesai

### Malam

* Baik
* Gerimis
* Hujan
* Jam mulai
* Jam selesai

Jika tidak ada kegiatan malam, field boleh kosong.

---

# 23. MATERIAL DAN ALAT

Laporan harian harus dapat mencatat:

## Material/alat diterima

* Nama material/alat
* Jumlah
* Satuan
* Tanggal diterima
* Keterangan

## Material/alat ditolak

* Nama material/alat
* Jumlah
* Satuan
* Alasan penolakan
* Keterangan

Contoh:

```text
Material diterima:
Pipa PVC DN-800
Jumlah: 50
Satuan: M

Material ditolak:
Pipa PVC DN-800
Jumlah: 5
Satuan: M
Alasan: Kondisi material tidak sesuai.
```

---

# 24. MASALAH LAPANGAN

Setiap laporan harian dapat mencatat:

* Masalah
* Tanggal
* Lokasi
* Dampak
* Penyelesaian
* Status
* Catatan

Contoh:

```text
Masalah:
Hujan menyebabkan pekerjaan galian tertunda.

Penyelesaian:
Pekerjaan dilanjutkan setelah kondisi lapangan memungkinkan.
```

Status:

* Belum Ditangani
* Sedang Ditangani
* Selesai

---

# 25. DOKUMENTASI

Laporan harian dapat memiliki foto.

Data:

* Foto
* Tanggal
* Keterangan
* Lokasi jika tersedia
* Kegiatan terkait
* Pengunggah

Foto harus dapat dilihat kembali pada:

* Detail laporan harian
* Detail pekerjaan
* Dokumentasi proyek
* Laporan mingguan/bulanan jika diperlukan

---

# 26. PEMERIKSAAN LAPORAN HARIAN

Alur:

```text
Inspector
    ↓
Simpan Sementara
    ↓
Kirim untuk Diperiksa
    ↓
Team Leader
    ↓
Setujui
atau
Minta Perbaikan
```

Status:

* Belum Dikirim
* Menunggu Pemeriksaan
* Perlu Diperbaiki
* Sudah Disetujui

Jika meminta perbaikan:

* Catatan perbaikan wajib diisi.

---

# 27. ATURAN DATA YANG SUDAH DISETUJUI

Setelah laporan disetujui:

* Tidak boleh diedit secara diam-diam.
* Tidak boleh dihapus oleh Inspector.
* Perubahan harus melalui mekanisme perubahan/revisi.
* Riwayat perubahan harus tetap tersedia.

---

# 28. PROGRESS AKTUAL

Progress aktual dihitung berdasarkan pekerjaan.

Untuk pekerjaan berbasis volume:

```text
Persentase Volume =
Volume Aktual / Volume Kontrak × 100
```

Kemudian:

```text
Progress Tertimbang =
Persentase Volume × Bobot Pekerjaan
```

Contoh:

```text
Volume kontrak = 1.000 M3
Volume aktual = 250 M3

Progress volume = 25%

Bobot pekerjaan = 10%

Progress tertimbang = 25% × 10%
                    = 2,5%
```

---

# 29. PROGRESS PERIODE

Sistem harus membedakan:

* Progress periode sebelumnya
* Progress periode berjalan
* Progress kumulatif

Contoh:

```text
Progress minggu lalu = 10%
Progress minggu ini = 5%
Progress sampai minggu ini = 15%
```

Jangan menyimpan hanya satu angka progress tanpa periode.

---

# 30. PROGRESS MINGGUAN

Laporan mingguan harus menampilkan minimal:

| Data                 | Keterangan                     |
| -------------------- | ------------------------------ |
| Pekerjaan            | Nama pekerjaan                 |
| Satuan               | Satuan pekerjaan               |
| Volume               | Volume kontrak                 |
| Harga Satuan         | Harga per satuan               |
| Jumlah Harga         | Volume × harga                 |
| Bobot                | Bobot pekerjaan                |
| Progress Minggu Lalu | Progress sebelumnya            |
| Progress Minggu Ini  | Progress periode               |
| Progress Kumulatif   | Progress sampai periode        |
| Bobot Minggu Lalu    | Progress tertimbang sebelumnya |
| Bobot Minggu Ini     | Progress tertimbang periode    |
| Bobot Kumulatif      | Progress tertimbang kumulatif  |
| Keterangan           | Status pekerjaan               |

Status pekerjaan dapat menggunakan:

* Belum Dikerjakan
* Sedang Dikerjakan
* Selesai

---

# 31. PROGRESS BULANAN

Laporan bulanan menggunakan konsep yang sama.

Harus dapat menampilkan:

* Progress bulan sebelumnya
* Progress bulan ini
* Progress kumulatif
* Progress rencana
* Selisih progress

---

# 32. PERHITUNGAN SELISIH

Formula:

```text
Selisih Progress =
Progress Aktual Kumulatif
-
Progress Rencana Kumulatif
```

Contoh:

```text
Progress aktual = 42%
Progress rencana = 45%

Selisih = -3%
```

UI menampilkan:

```text
Progress Aktual: 42%
Target Progress: 45%
Selisih Progress: -3%
```

Jangan memberikan label evaluatif otomatis seperti:

```text
Bagus
Buruk
Aman
Gagal
```

Sistem cukup menampilkan data faktual.

---

# 33. GRAFIK RENCANA DAN AKTUAL

Sistem harus menyediakan grafik S-Curve.

Minimal menampilkan:

* Rencana Awal
* Rencana Terbaru
* Progress Aktual

Sumbu X:

```text
Periode waktu
```

Sumbu Y:

```text
Persentase progress
```

Jika belum ada data Rencana Awal atau Rencana Terbaru, sistem harus menampilkan keadaan yang jelas dan tidak error.

---

# 34. ATURAN CUT-OFF PROGRESS

Perubahan rencana tidak boleh mengubah sejarah aktual.

Contoh:

```text
Minggu 1:
Aktual = 5%

Minggu 2:
Aktual = 12%

Minggu 3:
Aktual = 20%
```

Kemudian pada Minggu 4 rencana diubah.

Maka:

```text
Aktual Minggu 1 = tetap 5%
Aktual Minggu 2 = tetap 12%
Aktual Minggu 3 = tetap 20%
```

Yang berubah hanya data rencana.

---

# 35. LAPORAN MINGGUAN

Sistem harus dapat menghasilkan laporan mingguan berdasarkan data database.

Isi minimal:

## Informasi proyek

* Nama kegiatan
* Nama pekerjaan
* Lokasi
* Nomor kontrak
* Tanggal kontrak
* Waktu pelaksanaan
* Minggu ke-
* Hari ke-
* Sisa hari

## Tabel pekerjaan

* Nomor
* Uraian pekerjaan
* Satuan
* Volume
* Harga satuan
* Jumlah harga
* Bobot
* Progress sebelumnya
* Progress minggu ini
* Progress kumulatif
* Bobot tertimbang
* Keterangan

## Ringkasan

* Total nilai pekerjaan
* Total progress periode
* Total progress kumulatif
* Progress rencana
* Selisih

---

# 36. LAPORAN BULANAN

Isi minimal:

* Identitas proyek
* Nomor kontrak
* Tanggal kontrak
* Nilai kontrak
* Periode laporan
* Daftar pekerjaan
* Volume
* Harga satuan
* Nilai pekerjaan
* Bobot
* Progress bulan sebelumnya
* Progress bulan berjalan
* Progress kumulatif
* Progress rencana
* Selisih
* Total progress
* Tanda tangan/pengesahan jika dibutuhkan

---

# 37. RINGKASAN PROYEK

Halaman Ringkasan harus sederhana.

Tampilkan:

```text
Nama Proyek

Target Progress
XX%

Progress Saat Ini
XX%

Selisih Progress
XX%

Hari Ke
XX

Sisa Hari
XX

Nilai Kontrak
Rp XXX
```

Kemudian:

* Grafik progress
* Pekerjaan sedang berjalan
* Laporan menunggu pemeriksaan
* Masalah lapangan
* Dokumentasi terbaru

---

# 38. RINGKASAN BERDASARKAN ROLE

## Administrator

Melihat:

* Jumlah proyek
* Proyek berjalan
* Proyek selesai
* Jumlah pengguna
* Laporan menunggu pemeriksaan
* Aktivitas sistem

## Owner

Melihat:

* Proyek
* Target progress
* Progress aktual
* Selisih
* S-Curve
* Laporan

## Team Leader

Melihat:

* Proyek yang dipimpin
* Target vs aktual
* Laporan menunggu pemeriksaan
* Pekerjaan berjalan
* Masalah lapangan
* Perubahan rencana

## Engineer

Melihat:

* Proyek yang ditugaskan
* Pekerjaan
* Progress
* Laporan
* Catatan teknis

## Inspector

Melihat:

* Proyek saya
* Laporan saya
* Laporan yang belum dikirim
* Laporan yang perlu diperbaiki
* Dokumentasi

---

# 39. DOKUMENTASI PROYEK

Sistem menyediakan halaman dokumentasi.

Filter:

* Proyek
* Tanggal
* Pekerjaan
* Laporan
* Pengunggah

Tampilan:

* Foto
* Tanggal
* Keterangan
* Kegiatan terkait

---

# 40. RIWAYAT PERUBAHAN

Sistem minimal menyimpan:

* Data dibuat oleh siapa
* Data dibuat kapan
* Data diubah oleh siapa
* Data diubah kapan
* Status
* Catatan perubahan

Khusus perubahan rencana:

* Versi sebelumnya
* Versi baru
* Alasan
* Pembuat
* Tanggal

---

# 41. MODEL DATA YANG DISARANKAN

Database minimal:

```text
users
roles
projects
project_members
project_plan_versions
project_plan_items
work_categories
work_items
daily_reports
daily_report_activities
daily_report_workforce
daily_report_weather
daily_report_materials
daily_report_problems
daily_report_photos
inspections
progress_records
report_periods
```

---

# 42. STRUKTUR RELASI

```text
users
  │
  ├── project_members ── projects
  │
  └── daily_reports

projects
  │
  ├── work_categories
  │       └── work_items
  │
  ├── project_plan_versions
  │       └── project_plan_items
  │
  ├── daily_reports
  │       ├── activities
  │       ├── workforce
  │       ├── weather
  │       ├── materials
  │       ├── problems
  │       └── photos
  │
  ├── inspections
  │
  └── progress_records
```

---

# 43. FIELD UTAMA `projects`

Minimal:

```text
id
project_code
activity_name
project_name
location
fiscal_year
contract_number
contract_date
initial_contract_value
current_contract_value
start_date
end_date
duration_days
client_name
client_agency
consultant_name
team_leader_id
status
description
created_at
created_by
updated_at
updated_by
```

---

# 44. FIELD `work_items`

```text
id
project_id
parent_id
code
name
description
unit
contract_volume
unit_price
total_price
weight
start_date
end_date
status
created_at
created_by
updated_at
updated_by
```

`parent_id` digunakan untuk struktur pekerjaan bertingkat.

---

# 45. FIELD `project_plan_versions`

```text
id
project_id
version_number
version_name
status
effective_date
reason
description
created_by
created_at
```

Status:

* Rencana Awal
* Aktif
* Tidak Aktif

Hanya satu versi yang boleh menjadi:

```text
Rencana Terbaru
```

pada satu waktu.

---

# 46. FIELD `project_plan_items`

```text
id
plan_version_id
work_item_id
period_type
period_number
period_start
period_end
planned_quantity
planned_percentage
planned_cumulative_percentage
created_at
updated_at
```

`period_type` minimal:

```text
MINGGUAN
BULANAN
```

---

# 47. FIELD `daily_reports`

```text
id
project_id
report_number
report_date
week_number
day_number
remaining_days
status
general_notes
submitted_by
submitted_at
reviewed_by
reviewed_at
review_note
approved_at
created_at
updated_at
```

---

# 48. FIELD `daily_report_activities`

```text
id
daily_report_id
work_item_id
description
location
quantity
unit
notes
```

---

# 49. FIELD `daily_report_workforce`

```text
id
daily_report_id
category
position
quantity
working_hours
notes
```

---

# 50. FIELD `daily_report_weather`

```text
id
daily_report_id
period
condition
start_time
end_time
notes
```

Period:

```text
PAGI
SIANG
SORE
MALAM
```

Condition:

```text
BAIK
GERIMIS
HUJAN
```

---

# 51. FIELD `daily_report_materials`

```text
id
daily_report_id
type
name
quantity
unit
reason
notes
```

Type:

```text
DITERIMA
DITOLAK
```

---

# 52. FIELD `daily_report_problems`

```text
id
daily_report_id
problem
location
impact
resolution
status
notes
```

---

# 53. FIELD `daily_report_photos`

```text
id
daily_report_id
work_item_id
file_url
caption
taken_at
uploaded_by
created_at
```

---

# 54. FIELD `progress_records`

```text
id
project_id
work_item_id
period_type
period_start
period_end
previous_quantity
period_quantity
cumulative_quantity
previous_percentage
period_percentage
cumulative_percentage
weighted_percentage
source
created_at
```

`source` dapat digunakan untuk membedakan:

```text
LAPORAN_HARIAN
KOREKSI
MANUAL
```

---

# 55. ATURAN SUMBER PROGRESS

Untuk prototype:

Progress yang digunakan dalam monitoring harus berasal dari data yang sudah diperiksa/disetujui.

Jangan menghitung progress resmi dari laporan yang masih:

```text
Belum Dikirim
```

atau

```text
Perlu Diperbaiki
```

---

# 56. WORKFLOW UTAMA

## Tahap 1 — Administrator

```text
Buat Pengguna
↓
Tetapkan Role
```

## Tahap 2 — Team Leader

```text
Buat Proyek
↓
Isi Data Kontrak
↓
Buat Daftar Pekerjaan
↓
Atur Volume
↓
Atur Harga
↓
Sistem Hitung Bobot
↓
Buat Rencana Awal
```

## Tahap 3 — Tim Lapangan

```text
Inspector
↓
Buat Laporan Harian
↓
Isi Kegiatan
↓
Isi Tenaga Kerja
↓
Isi Cuaca
↓
Isi Material
↓
Isi Masalah
↓
Upload Foto
↓
Kirim untuk Diperiksa
```

## Tahap 4 — Team Leader

```text
Periksa Laporan
↓
Setujui
atau
Minta Perbaikan
```

## Tahap 5 — Sistem

```text
Laporan Disetujui
↓
Progress Aktual
↓
Progress Mingguan
↓
Progress Bulanan
↓
Rencana vs Aktual
↓
Grafik
```

---

# 57. USE CASE UTAMA

## UC-01 Login

Aktor:

Semua pengguna.

Hasil:

Pengguna masuk sesuai role.

---

## UC-02 Kelola Pengguna

Aktor:

Administrator.

Fungsi:

* Tambah pengguna
* Ubah pengguna
* Aktif/nonaktif
* Tetapkan role

---

## UC-03 Kelola Proyek

Aktor:

Administrator / Team Leader.

Fungsi:

* Tambah proyek
* Ubah proyek
* Lihat proyek
* Tutup proyek

---

## UC-04 Kelola Tim

Aktor:

Team Leader.

Fungsi:

* Tambahkan Engineer
* Tambahkan Inspector
* Ubah penugasan
* Hapus penugasan

---

## UC-05 Kelola Daftar Pekerjaan

Aktor:

Team Leader.

Fungsi:

* Tambah kelompok
* Tambah pekerjaan
* Ubah pekerjaan
* Atur volume
* Atur satuan
* Atur harga
* Lihat bobot

---

## UC-06 Buat Rencana Awal

Aktor:

Team Leader.

Fungsi:

* Tentukan target per minggu
* Tentukan target per bulan
* Simpan sebagai Rencana Awal

---

## UC-07 Ubah Rencana

Aktor:

Team Leader.

Fungsi:

* Buat versi baru
* Masukkan alasan
* Ubah target
* Simpan riwayat

---

## UC-08 Buat Laporan Harian

Aktor:

Inspector.

---

## UC-09 Periksa Laporan

Aktor:

Team Leader.

---

## UC-10 Lihat Progress

Aktor:

Semua role sesuai hak akses.

---

## UC-11 Lihat Grafik

Aktor:

Administrator / Owner / Team Leader / Engineer.

---

## UC-12 Buat Laporan Mingguan

Aktor:

Team Leader / sistem.

Laporan dihasilkan berdasarkan data database.

---

## UC-13 Buat Laporan Bulanan

Aktor:

Team Leader / sistem.

---

# 58. HAK AKSES

| Modul            | Admin       | Owner       | TL           | Engineer      | Inspector      |
| ---------------- | ----------- | ----------- | ------------ | ------------- | -------------- |
| Pengguna         | CRUD        | Lihat       | Lihat        | -             | -              |
| Proyek           | CRUD        | Lihat       | CRUD         | Lihat         | Lihat          |
| Tim              | CRUD        | Lihat       | CRUD         | Lihat         | Lihat          |
| Daftar Pekerjaan | CRUD        | Lihat       | CRUD         | Lihat         | Lihat          |
| Rencana          | Lihat       | Lihat       | CRUD         | Lihat         | Lihat          |
| Laporan Harian   | Lihat       | Lihat       | CRUD/Periksa | Lihat         | CRUD milik     |
| Pemeriksaan      | Lihat       | Lihat       | CRUD         | Lihat         | Lihat          |
| Progress         | Lihat       | Lihat       | Lihat        | Lihat         | Lihat          |
| Grafik           | Lihat       | Lihat       | Lihat        | Lihat         | Lihat terbatas |
| Laporan          | Lihat/Unduh | Lihat/Unduh | Lihat/Unduh  | Lihat         | Lihat          |
| Dokumentasi      | Lihat       | Lihat       | CRUD         | CRUD terbatas | CRUD           |

Backend harus tetap menjadi sumber kebenaran hak akses.

Jangan hanya menyembunyikan tombol pada frontend.

---

# 59. VALIDASI UTAMA

## Proyek

* Nama wajib.
* Tanggal mulai wajib.
* Tanggal selesai wajib.
* Tanggal selesai tidak boleh sebelum tanggal mulai.
* Durasi dihitung otomatis.
* Nilai kontrak tidak boleh negatif.

## Daftar Pekerjaan

* Nama wajib.
* Satuan wajib.
* Volume tidak boleh negatif.
* Harga tidak boleh negatif.
* Bobot dihitung otomatis.
* Total bobot harus dipantau.

## Laporan Harian

* Tanggal wajib.
* Proyek wajib.
* Kegiatan wajib.
* Jumlah tenaga kerja harus valid.
* Material ditolak harus memiliki alasan.
* Laporan yang dikirim tidak boleh kosong.
* Foto wajib jika jenis pekerjaan/aturan pemeriksaan mensyaratkannya.

## Perubahan Rencana

* Alasan wajib.
* Versi otomatis.
* Tidak boleh mengubah aktual masa lalu.

---

# 60. STATUS LAPORAN

Gunakan:

```text
BELUM DIKIRIM
MENUNGGU PEMERIKSAAN
PERLU DIPERBAIKI
SUDAH DISETUJUI
```

Jangan tampilkan status teknis seperti:

```text
DRAFT
SUBMITTED
REJECTED
APPROVED
```

Status database boleh menggunakan bahasa Inggris jika diperlukan oleh implementasi teknis, tetapi UI harus Bahasa Indonesia.

---

# 61. OUTPUT LAPORAN

Prototype harus mampu menghasilkan:

1. Laporan Harian
2. Laporan Mingguan
3. Laporan Bulanan
4. Rekap Progress
5. Grafik Rencana vs Aktual
6. Rekap Tenaga Kerja
7. Rekap Material
8. Rekap Masalah Lapangan

Format:

* Tampilan web
* PDF
* Excel

Prioritaskan PDF dan Excel setelah fungsi inti selesai.

---

# 62. TEMPLATE LAPORAN

Sistem harus dirancang agar output laporan dapat mengikuti struktur laporan perusahaan.

Namun:

JANGAN membuat seluruh layout Excel menjadi struktur database.

Database menyimpan data terstruktur.

Kemudian sistem menggunakan data tersebut untuk membuat laporan.

Contoh:

```text
Database
   ↓
Data Proyek
   ↓
Data Pekerjaan
   ↓
Data Progress
   ↓
Template Laporan
   ↓
PDF / Excel
```

---

# 63. FITUR YANG TIDAK MASUK PROTOTYPE

Jangan mengembangkan:

* WhatsApp notification
* SMS
* Email notification
* Aplikasi Android native
* iOS native
* AI prediksi keterlambatan
* Machine learning
* BIM
* GIS
* Integrasi ArcGIS
* Integrasi sistem pemerintah
* Sistem keuangan
* Payroll
* Pengadaan
* Akuntansi
* ERP
* Multi perusahaan
* Multi tenant
* Offline-first
* Real-time collaboration kompleks
* RFI kompleks
* NCR kompleks
* VO kompleks
* Manajemen dokumen enterprise
* Disaster Recovery enterprise

Fitur tersebut dapat menjadi pengembangan berikutnya.

---

# 64. PRIORITAS PENGEMBANGAN

## P0 — WAJIB

* Login
* Hak akses
* Pengguna
* Proyek
* Tim proyek
* Daftar pekerjaan
* Perhitungan bobot

## P1 — INTI MONITORING

* Rencana awal
* Perubahan rencana
* Laporan harian
* Tenaga kerja
* Cuaca
* Material
* Masalah
* Dokumentasi
* Pemeriksaan
* Persetujuan

## P2 — MONITORING

* Progress aktual
* Progress mingguan
* Progress bulanan
* Rencana vs aktual
* Selisih
* S-Curve

## P3 — OUTPUT

* PDF
* Excel
* Rekap
* Filter
* Pencarian
* Dokumentasi

---

# 65. ATURAN UNTUK AI AGENT

AI Agent WAJIB mengikuti aturan berikut.

## 65.1 Jangan membuat ulang aplikasi dari nol

Sebelum coding:

1. Baca struktur repository.
2. Identifikasi frontend.
3. Identifikasi backend.
4. Identifikasi database.
5. Identifikasi routing.
6. Identifikasi komponen UI.
7. Identifikasi authentication.
8. Identifikasi schema database yang sudah ada.

Jika fitur sudah tersedia:

```text
REUSE
```

jangan membuat versi kedua.

---

# 66. JANGAN MERUSAK FITUR YANG SUDAH ADA

Sebelum mengubah kode:

* Periksa dependensi.
* Periksa API.
* Periksa database.
* Periksa route.
* Periksa komponen yang digunakan halaman lain.

Jangan melakukan rewrite besar hanya karena implementasi sebelumnya kurang rapi.

---

# 67. DATABASE-FIRST

Semua data bisnis harus memiliki sumber data database.

Jangan:

```text
hardcode data proyek
hardcode progress
hardcode user
hardcode daftar pekerjaan
```

Gunakan database.

---

# 68. BUSINESS LOGIC

Business logic harus berada di backend/service layer.

Contoh:

```text
Perhitungan Bobot
Perhitungan Progress
Perhitungan Selisih
Validasi Approval
Validasi Perubahan Rencana
```

Jangan mengandalkan frontend untuk keamanan atau validasi bisnis utama.

---

# 69. PERHITUNGAN HARUS KONSISTEN

Jangan membuat:

```text
Progress di Dashboard = rumus A
Progress di Laporan Mingguan = rumus B
Progress di Laporan Bulanan = rumus C
```

Gunakan satu service perhitungan progress.

Contoh:

```text
ProgressService
```

yang digunakan oleh:

* Dashboard
* Detail proyek
* Laporan mingguan
* Laporan bulanan
* Grafik
* API

---

# 70. TANGGAL DAN PERIODE

Semua perhitungan periode harus menggunakan tanggal proyek.

Jangan berasumsi:

```text
Minggu selalu Senin-Minggu
```

Karena contoh laporan menggunakan tanggal mulai proyek sebagai dasar periode.

Sistem harus dapat menentukan:

```text
Tanggal Mulai Proyek
↓
Hari ke-
↓
Minggu ke-
↓
Periode
```

---

# 71. PERUBAHAN RENCANA

AI Agent dilarang melakukan:

```text
UPDATE rencana lama
```

tanpa menyimpan riwayat.

Gunakan:

```text
INSERT versi rencana baru
```

Kemudian tandai versi lama sebagai tidak aktif jika diperlukan.

---

# 72. AKTUAL TIDAK BOLEH DIUBAH OLEH PERUBAHAN RENCANA

Ini adalah business rule wajib.

Contoh:

```text
Rencana V1
Aktual Januari = 10%

Rencana V2 dibuat

Aktual Januari tetap = 10%
```

Jangan menghitung ulang sejarah aktual berdasarkan rencana baru.

---

# 73. UI RULE

Semua halaman harus memiliki:

* Loading state
* Empty state
* Error state
* Success feedback
* Validation feedback

Contoh:

Jangan:

```text
Error 422
```

Gunakan:

```text
Data belum dapat disimpan.
Silakan periksa kembali isian Anda.
```

---

# 74. FORM RULE

Jangan menampilkan 30–50 field sekaligus.

Gunakan kelompok:

### Informasi Proyek

### Informasi Pekerjaan

### Progress

### Tenaga Kerja

### Cuaca

### Material

### Masalah

### Dokumentasi

### Pemeriksaan

---

# 75. CONTOH FORM LAPORAN HARIAN

## Informasi Laporan

Tanggal:

[ 16 September 2026 ]

Minggu ke:

[ 9 ]

Hari ke:

[ 63 ]

Sisa hari:

[ 87 ]

---

## Kegiatan

Pekerjaan:

[ Galian Tanah ]

Kegiatan:

[........................]

Volume:

[ 50 ]

Satuan:

[ M3 ]

---

## Tenaga Kerja

| Jenis            | Jumlah | Jam |
| ---------------- | -----: | --: |
| Manager Lapangan |      1 |   8 |
| Operator         |      3 |   8 |
| Pelaksana        |      1 |   8 |
| Pekerja          |      1 |   8 |

---

## Cuaca

Pagi:

○ Baik
○ Gerimis
○ Hujan

---

## Material

[+ Tambah Material]

---

## Masalah

[........................]

---

## Dokumentasi

[+ Tambah Foto]

---

## Tombol

[Simpan Sementara]

[Kirim untuk Diperiksa]

---

# 76. CONTOH RINGKASAN PROYEK

```text
PROYEK PEMASANGAN JARINGAN PERPIPAAN

Target Progress
45,20%

Progress Saat Ini
42,10%

Selisih Progress
-3,10%

Hari ke
73

Sisa Hari
77
```

Kemudian:

```text
Grafik Rencana dan Progress
```

dan:

```text
Laporan Menunggu Pemeriksaan
3
```

---

# 77. PENCARIAN DAN PENYARINGAN

Data proyek harus dapat dicari berdasarkan:

* Nama proyek
* Kode proyek
* Nomor kontrak
* Lokasi
* Status

Data laporan dapat disaring berdasarkan:

* Proyek
* Tanggal
* Minggu
* Bulan
* Status
* Pembuat

---

# 78. KEAMANAN

Minimal:

* Password di-hash.
* Authentication di backend.
* Authorization di backend.
* Validasi input.
* Validasi upload.
* Batas ukuran file.
* Batas tipe file.
* Jangan expose credential.
* Jangan menyimpan password plaintext.
* Jangan mempercayai role dari frontend.
* Jangan mengizinkan user mengakses project yang tidak memiliki hak akses.

---

# 79. ACCEPTANCE CRITERIA

## Login

* User dapat login.
* User diarahkan sesuai role.
* User tanpa hak akses tidak dapat membuka halaman tertentu.
* Logout bekerja.

## Proyek

* Admin/TL dapat membuat proyek.
* Data tersimpan database.
* Detail proyek dapat dibuka.
* Project assignment bekerja.

## Daftar Pekerjaan

* TL dapat membuat pekerjaan.
* Volume dan harga dapat disimpan.
* Bobot dihitung.
* Total bobot dapat diperiksa.

## Rencana

* TL dapat membuat Rencana Awal.
* Target mingguan dapat disimpan.
* Target bulanan dapat disimpan.
* Perubahan rencana membuat versi baru.
* Rencana lama tetap tersedia.

## Laporan Harian

* Inspector dapat membuat laporan.
* Inspector dapat menambahkan kegiatan.
* Tenaga kerja dapat dicatat.
* Cuaca dapat dicatat.
* Material dapat dicatat.
* Masalah dapat dicatat.
* Foto dapat diunggah.
* Laporan dapat dikirim.

## Pemeriksaan

* TL dapat melihat laporan yang menunggu pemeriksaan.
* TL dapat menyetujui.
* TL dapat meminta perbaikan.
* Catatan perbaikan wajib ketika meminta perbaikan.

## Progress

* Progress hanya menggunakan data yang sah/disetujui.
* Progress pekerjaan dapat dihitung.
* Progress kumulatif benar.
* Bobot progress benar.
* Total progress dapat dihitung.

## Grafik

* Rencana tampil.
* Aktual tampil.
* Selisih dapat dihitung.
* Perubahan rencana dapat ditampilkan sesuai versinya.

## Laporan

* Laporan mingguan dapat dibuat.
* Laporan bulanan dapat dibuat.
* Data laporan berasal dari database.
* Tidak ada hardcoded project data.

---

# 80. TESTING

AI Agent wajib membuat pengujian untuk minimal:

### Authentication

* Login benar
* Login salah
* Hak akses

### Project

* CRUD
* Validasi tanggal
* Assignment

### Work Item

* Volume
* Harga
* Bobot
* Total bobot

### Planning

* Rencana awal
* Perubahan rencana
* Versi
* Effective date

### Daily Report

* Create
* Edit
* Submit
* Revision
* Approval

### Progress

* Quantity
* Percentage
* Weighted progress
* Cumulative progress
* Deviation

### Reporting

* Weekly
* Monthly
* Export

---

# 81. END-TO-END TEST

AI Agent harus memastikan skenario berikut berjalan:

```text
Administrator
↓
Membuat pengguna
↓
Team Leader
↓
Membuat proyek
↓
Membuat daftar pekerjaan
↓
Membuat rencana
↓
Menugaskan Inspector
↓
Inspector
↓
Membuat laporan harian
↓
Mengisi kegiatan
↓
Mengisi tenaga kerja
↓
Mengisi cuaca
↓
Mengisi material
↓
Mengunggah foto
↓
Kirim untuk Diperiksa
↓
Team Leader
↓
Memeriksa
↓
Setujui
↓
Sistem
↓
Menghitung progress
↓
Menghasilkan progress mingguan
↓
Menghasilkan progress bulanan
↓
Menghasilkan grafik Rencana vs Aktual
↓
Owner
↓
Melihat monitoring
```

Skenario ini wajib berhasil tanpa manipulasi database secara manual.

---

# 82. DEFINITION OF DONE

Sebuah fitur dianggap selesai apabila:

* Frontend selesai.
* Backend selesai.
* Database terhubung.
* Authorization selesai.
* Validation selesai.
* Loading state tersedia.
* Empty state tersedia.
* Error state tersedia.
* Data tidak hardcode.
* Business logic berada di tempat yang benar.
* Test tersedia untuk fungsi kritis.
* Tidak ada error TypeScript.
* Tidak ada error build.
* Tidak ada critical console error.
* Workflow dapat digunakan dari awal sampai akhir.

---

# 83. PRIORITAS IMPLEMENTASI UNTUK AI AGENT

Urutan implementasi:

```text
STEP 1
Analisis repository yang sudah ada

STEP 2
Analisis database/schema yang sudah ada

STEP 3
Authentication + Role

STEP 4
Pengguna

STEP 5
Proyek

STEP 6
Tim Proyek

STEP 7
Daftar Pekerjaan

STEP 8
Perhitungan Bobot

STEP 9
Rencana Awal

STEP 10
Perubahan Rencana

STEP 11
Laporan Harian

STEP 12
Pemeriksaan + Persetujuan

STEP 13
Progress Aktual

STEP 14
Progress Mingguan

STEP 15
Progress Bulanan

STEP 16
Dashboard/Ringkasan

STEP 17
S-Curve

STEP 18
Dokumentasi

STEP 19
PDF/Excel

STEP 20
Testing End-to-End
```

---

# 84. INSTRUKSI KHUSUS UNTUK IMPLEMENTASI

AI Agent harus:

1. Membaca repository sebelum coding.
2. Tidak membuat fitur di luar PRD tanpa alasan.
3. Tidak membuat data dummy sebagai pengganti database.
4. Tidak menghapus fitur existing tanpa alasan.
5. Tidak mengganti arsitektur tanpa kebutuhan.
6. Menggunakan komponen reusable.
7. Menggunakan TypeScript dengan typing yang jelas.
8. Menjaga frontend dan backend tetap terpisah secara jelas.
9. Menempatkan business logic di backend.
10. Menggunakan database migration untuk perubahan schema.
11. Tidak mengandalkan local state sebagai database.
12. Tidak melakukan silent overwrite.
13. Menyediakan error handling.
14. Menyediakan validasi.
15. Menulis test untuk perhitungan progress.
16. Menulis test untuk versioning rencana.
17. Menulis test untuk approval laporan.
18. Menjaga seluruh UI menggunakan Bahasa Indonesia.

---

# 85. PRINSIP DESAIN TERPENTING

Gunakan prinsip:

> **"Pengguna tidak perlu tahu sistem bekerja bagaimana. Pengguna hanya perlu tahu apa yang harus dilakukan."**

Contoh:

Jangan membuat pengguna memahami:

```text
project_plan_versions
weighted_progress
cumulative_quantity
baseline
revision
```

Tampilkan:

```text
Rencana Awal
Rencana Terbaru
Progress Saat Ini
Target Progress
Selisih Progress
Riwayat Perubahan
```

---

# 86. BATASAN PROTOTYPE

Sistem ini adalah:

**PROTOTYPE / MVP**

Bukan sistem production enterprise.

Prioritas:

```text
Kemudahan penggunaan
+
Ketepatan data
+
Ketepatan perhitungan
+
Workflow yang jelas
```

bukan:

```text
Kompleksitas fitur
+
Jumlah fitur
+
Over-engineering
```

---

# 87. HASIL AKHIR YANG DIHARAPKAN

Setelah implementasi, pengguna harus dapat melakukan:

```text
Login
↓
Melihat Proyek
↓
Membuka Detail Proyek
↓
Melihat Daftar Pekerjaan
↓
Melihat Rencana
↓
Mencatat Kegiatan Harian
↓
Mencatat Tenaga Kerja
↓
Mencatat Cuaca
↓
Mencatat Material
↓
Mencatat Masalah
↓
Mengunggah Foto
↓
Mengirim Laporan
↓
Team Leader Memeriksa
↓
Progress Terhitung
↓
Laporan Mingguan Terbentuk
↓
Laporan Bulanan Terbentuk
↓
Grafik Rencana vs Aktual Terbentuk
↓
Owner Dapat Melihat Kondisi Proyek
```

---

# 88. CATATAN PENUTUP UNTUK AI AGENT

Jadikan dokumen PRD ini sebagai **source of truth untuk kebutuhan fitur prototype**.

Namun sebelum mengimplementasikan:

1. Baca seluruh codebase yang sudah ada.
2. Identifikasi fitur yang sudah tersedia.
3. Identifikasi database yang sudah tersedia.
4. Pertahankan fitur yang masih kompatibel.
5. Refactor hanya jika diperlukan.
6. Implementasikan kebutuhan yang belum tersedia.
7. Jangan menganggap struktur Excel harus disalin satu per satu ke database.
8. Gunakan Excel sebagai referensi kebutuhan bisnis dan format laporan.
9. Prioritaskan data terstruktur dan workflow.
10. Pastikan perhitungan progress konsisten di seluruh aplikasi.

**Kaidah utama:**

```text
Excel = Referensi dan Output

Database = Sumber Data Utama

Backend = Sumber Kebenaran Business Logic

Frontend = Antarmuka Pengguna

Laporan Harian = Sumber Data Aktivitas Lapangan

Rencana = Memiliki Versi

Aktual = Tidak Boleh Ditimpa

Progress = Dihitung Konsisten

UI = Bahasa Indonesia + Sederhana
```

# END OF PRD
