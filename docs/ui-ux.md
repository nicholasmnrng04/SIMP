# Navigasi dan alur SIMP

Perombakan 2 Oktober 2026 mengikuti struktur yang disetujui: pilih proyek dahulu, kemudian kerjakan tugas di dalam proyek. Perubahan berada di frontend; API, perhitungan, database, migration, izin, dan format cetak workbook tetap menggunakan implementasi sebelumnya.

## Cara menemukan pekerjaan

Setelah masuk, **Beranda** menampilkan proyek yang dapat diakses dan ringkasan sesuai peran. Pilih proyek. Sidebar lalu menampilkan proyek aktif dan delapan tujuan proyek. Di HP, buka tombol menu untuk memakai pemilih proyek dan tujuan yang sama. Nama proyek, status, dan bagian aktif tetap tampil dalam header konteks yang ringkas.

| Bagian | Kegunaan |
| --- | --- |
| Ringkasan | Capaian, target, selisih, sisa hari, masalah, dan langkah berikutnya. Buka rincian kemajuan, grafik, atau riwayat bila diperlukan. |
| Laporan Harian | Membuat, melengkapi foto, mengirim, atau memeriksa laporan sesuai izin. |
| Rekap & Unduhan | Rekap mingguan/bulanan serta seluruh delapan jenis keluaran PDF dan Excel. |
| Daftar Pekerjaan | Susunan pekerjaan, volume, harga, bobot, sumber workbook, dan dokumentasi per pekerjaan. |
| Jadwal & Target | Menyusun, menetapkan, serta membandingkan rencana dan target. |
| Dokumentasi | Foto kegiatan sesuai akses, dengan filter tanggal, pekerjaan, laporan, dan pengunggah. |
| Tim | Anggota proyek dan masa penugasannya sesuai peran. |
| Informasi Proyek | Identitas, kontrak, nama kontraktor, status, dan tindakan pengelolaan proyek. |

**Pengguna** tetap berada di navigasi utama dan hanya tersedia untuk Administrator. Mengganti proyek dari sidebar mempertahankan tujuan yang sedang dibuka jika route tersebut tersedia pada proyek tujuan.

## Dashboard Team Leader

Beranda Team Leader mendahulukan kondisi yang perlu ditangani. Identitas proyek, status, tanggal data, dan pemilih proyek berada di bagian atas. Empat angka utama menunjukkan kemajuan aktual, target, selisih, dan laporan menunggu pemeriksaan. Pusat tindakan membuka langsung laporan, masalah, atau proyek terkait. Kurva-S dan capaian per periode memakai data pemantauan yang sama dengan halaman rincian; tiga foto terbaru berasal dari galeri proyek dan mengikuti izin akses. Tabel pemantauan seluruh proyek dapat dicari berdasarkan nama atau kode dan dipakai untuk membandingkan target, aktual, laporan tertunda, masalah, serta aktivitas terakhir tanpa membuka proyek satu per satu.

Role lain tetap memperoleh beranda sesuai kebutuhannya. Tidak ada tindakan atau proyek yang ditampilkan di luar izin pengguna.

## Alur berdasarkan peran

- **Administrator:** pilih proyek, kelola informasi dan penugasan pimpinan; kelola akun melalui Pengguna. Persetujuan teknis tidak tersedia.
- **Owner:** pilih proyek, lihat kemajuan, baca laporan disetujui, dokumentasi, dan rekap yang diizinkan.
- **Team Leader:** siapkan tim/pekerjaan/rencana; periksa laporan; setujui atau minta perbaikan dengan alasan. Pembuatan laporan tetap mengikuti izin sebelumnya.
- **Engineer:** buka laporan menunggu pemeriksaan, baca kegiatan/foto, lalu simpan catatan teknis. Catatan tidak menggantikan keputusan Team Leader.
- **Inspector:** buka laporan sendiri yang belum selesai, isi kegiatan/kondisi lapangan, simpan, lengkapi foto, periksa, kemudian kirim. Perbaikan dan koreksi tetap mengikuti aturan sebelumnya.

Tombol **Semua laporan** membuka daftar di luar antrean awal. Filter lebih lengkap tersedia pada **Filter laporan**. Alasan perbaikan dan catatan terakhir tampil di bagian atas detail laporan; pemeriksaan dan versi terdahulu tersedia dalam riwayat.

Menyimpan isian tidak mengirim laporan. Foto tetap diunggah setelah isian tersimpan. Kegiatan dengan volume positif tetap membutuhkan foto. Pengiriman mengunci isian biasa. Koreksi laporan disetujui tetap membuat versi baru; versi lama tetap digunakan sampai koreksi disetujui.

## Membaca dan mengunduh

Pilih jenis dan periode, lalu **Tampilkan Laporan**. Baca hasil di layar; buka **Pratinjau cetak** untuk melihat susunan workbook dan pilih **Unduh PDF** atau **Unduh Excel**. Pilihan logo tetap tersedia pada Pilihan cetak. Jika pilihan berubah, tampilkan ulang laporan sebelum mengunduh.

Jenis keluaran tetap: harian, mingguan, bulanan, kemajuan, grafik, tenaga kerja, material/alat, dan masalah lapangan. Ringkasan kemajuan memakai hasil API yang sama; pembulatan tampilan bukan input perhitungan. Minggu/bulan tetap mengikuti awal proyek.

## Tautan dan kompatibilitas

| Tautan | Tujuan |
| --- | --- |
| `/ringkasan` | Beranda |
| `/proyek/:id` dan `/proyek/:id/ringkasan` | Ringkasan proyek |
| `/proyek/:id/informasi` | Informasi dan tindakan pengelolaan proyek |
| `/proyek/:id/tim` | Tim dan penugasan |
| `/proyek/:id/pekerjaan` dan `/proyek/:id/rencana` | Dua bagian Rencana Pekerjaan |
| `/proyek/:id/laporan` dan `/proyek/:id/laporan/:reportId` | Daftar dan detail laporan |
| `/proyek/:id/laporan-berkala` | Rekap mingguan/bulanan |
| `/proyek/:id/progress` | Rincian kemajuan |
| `/proyek/:id/dokumentasi` | Galeri proyek |
| `/proyek/:id/dokumentasi/:workItemId` | Galeri dengan pilihan pekerjaan |
| `/proyek/:id/riwayat` | Riwayat proyek |
| `/proyek/:id/ekspor` | Laporan dan unduhan |

Filter yang diterapkan disimpan dalam URL, termasuk pilihan rencana dan hasil unduhan. Muat ulang dan tombol kembali memulihkan pilihan. Tautan lama tetap dapat dibuka; halaman masuk proyek kini menampilkan ringkasan, sedangkan informasi lengkap dipindahkan ke Tim & Informasi.

## Validasi

Iterasi referensi UI tanggal 5 Oktober 2026 menggunakan sidebar terang, pengelompokan menu yang selalu terbuka, serta tabel target–capaian dengan pemisah kelompok. Pola yang diambil adalah susunan informasi referensi, bukan ukuran teks kecil, tabel global yang meluber, atau data contoh dari gambar.

Alur membaca kemajuan: pilih proyek → baca KPI dan langkah berikutnya → pilih **Tabel pekerjaan** atau **Grafik rencana dan capaian** → buka rincian bila diperlukan. Pilihan tabel/grafik dapat dimuat ulang dan dipulihkan melalui tombol kembali. Alur Team Leader dimulai dari tindakan pemeriksaan dan tabel pemantauan; grafik tersedia langsung dalam panel terpisah.

Penyesuaian 6 Oktober 2026: desktop memakai teks 14px, sidebar 240px dan kontrol 40px; HP mempertahankan input 16px dan target sentuh 44px. Panel utama, filter, data tenaga kerja/cuaca dan hasil baca unduhan langsung terlihat tanpa accordion. Dropdown pilihan proyek/periode/versi dipertahankan. Detail teknis, riwayat dan pratinjau cetak tetap dapat dibuka sesuai kebutuhan. Penyesuaian ukuran dilakukan di `readable.scss` yang sudah ada.

Tes `tests/browser/readability.spec.ts` menggunakan fixture yang sudah tersedia untuk memeriksa filter presentasi, konteks kelompok dalam pencarian, angka sebelum/sesudah, drawer keyboard, screenshot 1440/768/390px, serta simulasi pembesaran CSS 200%. Simulasi tersebut bukan pengganti pemeriksaan zoom browser asli atau sesi bersama pengguna berusia lanjut.

Pengujian menggunakan skenario dan fixture yang sudah ada melalui runner tes terisolasi, ditambah pemeriksaan navigasi tanpa penambahan fixture bisnis. Tidak ada seed baru pada database aplikasi. Hasil perintah dan batas pengujian dicatat di `docs/progress.md`.

Audit dan pemeriksaan visual belum menggantikan uji penggunaan bersama petugas proyek. Umpan balik berikutnya sebaiknya menilai kemudahan memilih proyek, melengkapi laporan/foto di HP, memeriksa laporan, serta membaca kemajuan.
