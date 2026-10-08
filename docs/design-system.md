# Pedoman desain SIMP

Pedoman ini menjadi acuan tampilan prototipe SIMP. Tujuannya adalah membuat aplikasi mudah dipahami oleh tim proyek konstruksi tanpa mengubah aturan bisnis, hak akses, API, atau format data.

## Arah visual

SIMP memakai tampilan aplikasi operasional yang tenang, tegas, dan mudah dibaca di lapangan. Informasi yang membutuhkan tindakan ditempatkan lebih dahulu. Rincian kontrak, sumber hitungan, presisi enam desimal, dan riwayat lengkap dibuka saat diperlukan.

Fondasi komponen memakai Carbon Design System melalui `@carbon/react`. SIMP menambahkan lapisan tipis untuk bahasa Indonesia, status proyek, pola route, dan kebutuhan tampilan HP. Stylesheet Carbon dimuat per komponen yang dipakai agar seluruh katalog Carbon tidak ikut masuk ke bundle.

## Token utama

| Kegunaan | Nilai |
| --- | --- |
| Latar navigasi | `#FAF9F6` |
| Teks navigasi | `#24343C` |
| Menu aktif | Latar `#F7E8DB`, teks `#813508` |
| Tindakan utama | `#B54708` |
| Hover tindakan utama | `#8F3506` |
| Latar aplikasi | `#F7F7F5` |
| Permukaan isi | `#FFFFFF` |
| Teks utama | `#18242D` |
| Teks sekunder | `#53636D` |
| Garis pemisah | `#D6DDE1` |
| Fokus keyboard | `#0F62FE` |
| Sukses | `#18794E` |
| Peringatan | `#8A5A00` |
| Bahaya | `#B42318` |
| Informasi | `#175CD3` |

Fondasi berada di `client/src/redesign.scss`; lapisan keterbacaan aplikasi berada di `client/src/readable.scss` dan dibatasi pada `.workspace`. Jarak menggunakan kelipatan 4px dengan pilihan utama 8, 12, 16, 24, 32, dan 48px. Radius dibatasi pada 4px dan 8px. Bayangan hanya dipakai pada modal, drawer, dan elemen yang memang mengambang. Layout workbook dan dokumen ekspor tidak mengikuti lapisan ini.

## Tipografi dan angka

- Gunakan IBM Plex Sans bila tersedia, kemudian Noto Sans atau font sistem.
- Desktop: isi, label, input, tombol dan tabel 14px; judul halaman 24px; angka KPI 24px. Keterangan 13px.
- HP: isi dan tabel 15px; input 16px; judul halaman 22px; angka KPI 22px. Kontrol minimal 44px, sedangkan desktop 40px.
- Baris tabel memakai padding vertikal 10px. Panel berjarak 16–20px dengan padding 16px pada desktop dan 12px pada HP. Jangan mengecilkan aplikasi menggunakan CSS `zoom` atau `transform: scale()`.
- Judul mengikuti urutan halaman: satu `h1`, lalu `h2` untuk bagian dan `h3` untuk item.
- Huruf kapital hanya dipakai pada label konteks yang pendek.
- Angka memakai bentuk tabular agar mudah dibandingkan.
- Kartu ringkasan menampilkan dua desimal. Rincian perhitungan tetap menampilkan enam desimal.
- Tanggal antarmuka memakai kata **sampai**. Nilai asli API tidak diubah.

## Struktur navigasi

Navigasi global terdiri dari Beranda, Proyek, dan Pengguna khusus Administrator. Setelah proyek dipilih, sidebar menampilkan pemilih proyek dan delapan tujuan berikut secara langsung:

1. Ringkasan
2. Laporan Harian
3. Rekap & Unduhan
4. Dokumentasi
5. Daftar Pekerjaan
6. Jadwal & Target
7. Tim
8. Informasi Proyek

Empat tujuan pertama berada di kelompok **Pemantauan**, empat berikutnya di **Pengaturan proyek**. Kedua kelompok selalu terbuka; bukan submenu. Desktop memakai sidebar terang selebar 240px dan header akun minimal 56px. Pemilih proyek mempertahankan bagian aktif ketika pengguna berpindah proyek. HP memakai app bar minimal 60px, tombol berlabel **Menu**, dan drawer dengan tujuan yang sama. Drawer mendukung Escape, pembatasan fokus di dalam menu, dan pengembalian fokus. Nama proyek serta status berada di header ringkas, sedangkan judul halaman menjelaskan bagian aktif.

## Pola pembacaan ringkas

- Dashboard Team Leader mendahulukan proyek aktif, KPI, tindakan spesifik, grafik, dokumentasi terbaru, dan tabel proyek. Kurva-S serta capaian per periode terbuka di kolom utama; dokumentasi tampil di samping pada desktop lebar dan di bawah grafik pada layar sempit.
- Panel informasi menggunakan `section.info-panel`, heading, latar putih, border tipis, radius 4px dan tanpa bayangan. Satu panel untuk satu kelompok informasi; isi tetap berupa tabel atau baris, bukan kartu per baris.
- Filter tanggal/pembanding, filter laporan, filter foto, masalah lapangan, pekerjaan berjalan, catatan Engineer dan aktivitas Administrator langsung terbuka sesuai izin yang ada. Detail laporan membuka tenaga kerja/cuaca; hasil unduhan membuka grafik dan semua tabel setelah ditampilkan.
- Presisi, sumber data, metadata foto, riwayat/perbandingan versi dan pratinjau workbook tetap opsional. Pemilih proyek/periode/versi tetap berupa dropdown; mekanisme tindakan berisiko tetap sama.
- Ringkasan proyek menyediakan **Tabel pekerjaan** dan **Grafik rencana dan capaian**. Pilihan menggunakan query `display=table|curve` khusus frontend; tidak dikirim ke API. Tanggal dan pembanding tetap memakai filter yang sudah tersedia.
- `WorkProgressTable` membandingkan target fisik dan capaian fisik per item. Baris kelompok hanya menunjukkan kontribusi berbobot yang diterima dari backend. Jangan menghitung persentase fisik kelompok dengan menjumlahkan persentase anak.
- Bar menampilkan angka dua desimal; **Angka lengkap** menyimpan presisi enam desimal. Garis dan marker kurva berbeda bentuk, dengan tabel angka yang tetap dapat dibuka.
- Pencarian uraian mempertahankan kelompok induk. Daftar pekerjaan juga bisa disaring berdasarkan kelompok tanpa mengubah hierarki atau data tersimpan.
- Editor sumber daya dan target memakai baris field dengan divider. Form, validasi, tahapan, dan tindakan bisnis tetap sama.
- Tabel perbandingan lebar bergulir di area khusus. Jangan mengecilkan teks untuk memaksakan semua kolom masuk ke HP.

## Komponen bersama

Komponen adapter berada di `client/src/components/ui.tsx`:

| Komponen | Kegunaan |
| --- | --- |
| `PageHeader` | Judul, konteks, penjelasan, dan tindakan utama halaman |
| `MetricTile` | Angka ringkasan dengan hierarki konsisten |
| `StatusTag` | Status semantik yang tetap memiliki teks |
| `ActionBar` | Kelompok tindakan form, termasuk posisi lengket |
| `FilterPanel` | Filter yang dapat dibuka saat diperlukan |
| `FormSection` | Bagian formulir dengan judul dan penjelasan |
| `ConfirmActionModal` | Konfirmasi tindakan penting tanpa dialog browser |
| `EmptyState` | Kondisi kosong dengan penjelasan dan tindakan |
| `LoadingPanel` | Loading yang mempertahankan bentuk halaman |
| `HistoryTimeline` | Riwayat yang mudah dipindai berdasarkan urutan waktu |

Tombol utama hanya satu dalam satu konteks. Tindakan berbahaya memakai warna merah dan kalimat dampak yang jelas. Status tidak boleh dibedakan melalui warna saja.

## Form, tabel, dan rincian

- Label selalu terlihat dan terhubung ke kontrolnya.
- Pesan validasi ditempatkan dekat field yang bermasalah.
- Form panjang memakai langkah yang jelas dan action bar yang mudah dijangkau.
- Filter dan metadata lanjutan memakai disclosure.
- Tabel lengkap boleh bergulir di dalam area berlabel; dokumen tidak boleh bergulir horizontal.
- Kumpulan data seperti proyek, laporan, pekerjaan, anggota tim, target, dan versi rencana menggunakan tabel adaptif.
- Di HP, tabel sederhana berubah menjadi baris berlabel dengan divider tanpa kartu per baris. Tabel perbandingan yang lebar tetap berada dalam area gulir khusus.
- Informasi satu objek memakai pasangan label–nilai. Form memakai bagian datar, grid field, dan divider; hindari container untuk setiap kelompok kecil.
- Kartu dibatasi untuk KPI, perhatian penting, tindakan prioritas, dan dokumentasi foto.
- Pratinjau workbook memiliki area gulir sendiri dan tidak mengikuti style tabel aplikasi.

## Dashboard Team Leader

Dashboard Team Leader adalah pusat pemantauan operasional. Urutannya adalah identitas dan pemilih proyek, empat KPI, pusat tindakan, Kurva-S dan capaian per periode, tiga foto terbaru yang dapat diakses, lalu tabel seluruh proyek yang menjadi tanggung jawabnya. Pada desktop lebar, kedua grafik berada di kolom kiri dan dokumentasi di kolom kanan; pada HP panel ditumpuk. Tabel proyek dapat dicari berdasarkan nama atau kode. Data berasal dari endpoint dashboard, pemantauan, dan galeri yang sudah ada. Dashboard tidak menghitung kemajuan sendiri dan tidak menampilkan data contoh.

Lebar panel dashboard mengikuti ruang isi yang tersedia, termasuk saat browser diperbesar 200%. Pada ruang sempit, identitas proyek dan grafik menjadi satu kolom, sedangkan KPI menjadi dua kolom. Tabel portofolio tetap bergulir di area tabelnya sendiri.

Tindakan yang perlu perhatian didahulukan: laporan menunggu pemeriksaan, laporan yang perlu diperbaiki, masalah lapangan, proyek terlambat, dan proyek yang belum memiliki rencana. Dashboard role lain tetap mengikuti kebutuhan role masing-masing.

## Bahasa antarmuka

Gunakan istilah Indonesia yang berorientasi pada tugas: **Kemajuan**, **Sampai tanggal**, **Total sampai tanggal ini**, **Selisih terhadap target**, **Tetapkan rencana**, dan **Unduh**. Istilah domain konstruksi seperti bobot, volume, kontrak, Team Leader, Engineer, dan Inspector tetap dipakai.

Nama tabel, status internal, payload API, istilah migration, dan penjelasan implementasi tidak ditampilkan kepada pengguna biasa.

## Aksesibilitas dan responsivitas

- Kontrol desktop setinggi minimal 40px; pada HP target sentuh minimal 44px.
- Fokus keyboard harus terlihat jelas.
- Teks biasa memenuhi kontras minimum 4,5:1.
- Modal memiliki nama, tombol tutup, tindakan utama, dan pengembalian fokus.
- Gerak dikurangi saat `prefers-reduced-motion` aktif.
- Validasi dilakukan pada lebar desktop 1280/1440px dan HP 390px. Tablet 768px memakai susunan responsif yang sama tanpa kehilangan route atau data.

## Batas perubahan

Design system ini hanya mengubah frontend dan tes presentasi. Database, migration, API, autentikasi, role, permission, route, perhitungan kemajuan, aturan persetujuan, struktur laporan, dan layout workbook tetap dipertahankan.
