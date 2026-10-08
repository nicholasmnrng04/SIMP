# Analisis PRD SIMP versi 2.0

Tanggal analisis: 28 September 2026. Sumber: [prd.md](../prd.md), seluruh bagian 1–88.

## Kesimpulan

SIMP adalah aplikasi pencatatan dan monitoring proyek berbasis database. Jalur bisnis utamanya adalah proyek → pekerjaan dan bobot → rencana terversi → laporan harian → persetujuan → progress resmi → laporan/grafik → monitoring Owner. Prototype harus membuktikan jalur tersebut bekerja dengan data tersimpan, bukan sekadar kumpulan halaman.

PRD sudah kuat pada cakupan modul, role, bahasa UI, dan perlindungan histori. Bagian yang perlu keputusan implementasi terutama definisi periode, representasi persentase, koreksi data sah, dan keterkaitan rencana mingguan/bulanan. Daftar field di §41–54 adalah rancangan awal, belum schema lengkap.

## Kondisi awal yang ditemukan

- Workspace hanya berisi `prd.md` saat analisis; belum ada aplikasi, schema, migration, atau tes.
- Tidak ditemukan `AGENTS.md` dalam workspace saat inspeksi awal.
- Saat analisis awal workbook belum tersedia. Pembaruan T00: `LAPORAN PROYEK contoh.xlsx` tersedia, berisi TS, M1–M5, B1, H0–H5. T03 memeriksa formula nilai/bobot; T04 menemukan periode M1/B1 mengacu tabel eksternal dan minggu pertama empat hari. Implementasi mengikuti minggu tujuh hari sejak start sesuai PRD; detail keputusan ada di `docs/decisions.md`. Formula eksternal lengkap dan kesamaan visual belum diverifikasi.
- Belum ada keputusan framework, database, hosting, atau penyimpanan foto. Jangan menganggap stack dari proyek lain berlaku di sini.
- Sesi analisis awal menghasilkan skill dan rencana. Implementasi T00 berikutnya dicatat pada [progress](progress.md) dan [arsitektur](architecture.md).

## Batas prototype

Semua P0–P3 tetap masuk target akhir. Penyederhanaan dilakukan pada arsitektur dan operasi: satu aplikasi modular, database relasional, penyimpanan foto sederhana, layanan perhitungan bersama, serta demo lokal. Hak akses backend, persistensi, migration, validasi, transaksi persetujuan, histori, dan tes perhitungan tetap diperlukan.

PDF dan Excel adalah tahap akhir setelah fungsi inti, bukan dihapus dari scope. Exact layout workbook dicatat sebagai verifikasi tertunda jika sumber belum tersedia. Tidak memasukkan fitur §63, deployment production, infrastruktur enterprise, atau jaminan kapasitas production.

## Celah dan keputusan awal

Semua keputusan berikut adalah **asumsi prototype**, bukan persyaratan tambahan yang telah disetujui pengguna. Agen boleh melanjutkan menggunakan asumsi ini setelah menyatakannya; ubah jika pengguna memberi aturan berbeda. Kontrak rinci dan contoh uji berada di [aturan domain skill](../skills/simp-prototype/references/domain-rules.md).

| Topik | Temuan PRD | Keputusan awal dan dampak |
| --- | --- | --- |
| Persentase | Contoh benar, formula berpotensi salah skala saat angka disimpan 0–100 | `weightedPct = physicalPct × weightPct / 100`; satu service |
| Hierarki pekerjaan | Parent tersedia tetapi aturan agregasi tidak disebut | Hanya pekerjaan daun memiliki nilai yang dihitung; induk adalah agregat |
| Bobot | TL mengatur bobot, tetapi validasi menyebut otomatis | TL mengatur volume/harga; bobot otomatis; edit bobot manual tidak dibangun |
| Minggu/bulan | Minggu mulai tanggal proyek; bulan belum didefinisikan rinci | Minggu tujuh hari sejak start; bulan berulang dari tanggal start, clamp akhir bulan |
| Dua granularitas rencana | Mingguan dan bulanan harus dapat disimpan | Satu granularitas sumber per versi, yang lain agregasi alokasi tanggal; hindari dua sumber berbeda |
| Effective date | Tanggal berlaku ada tetapi versi masa depan belum dijelaskan | Versi masa depan belum menjadi rencana aktif; pemilihan sesuai cutoff |
| Identitas baseline | Status mencampur Rencana Awal/Aktif/Tidak Aktif | Identitas versi pertama dipisahkan dari status aktif |
| Basis progress | Perubahan volume/harga dapat mengubah bobot historis | Bekukan basis setelah baseline; perubahan jadwal tetap bebas melalui versi baru |
| Volume lebih dari kontrak | Tidak ditentukan | Validasi eksplisit saat kirim/setujui, tidak clamp diam-diam |
| Koreksi laporan sah | Revisi wajib tetapi alurnya belum rinci | Revisi turunan, persetujuan ulang, penggantian kontribusi atomik dan audit |
| Approval terlambat | Cut-off aktual dijelaskan untuk revisi rencana | Masuk tanggal kegiatan; perubahan akibat persetujuan/koreksi sah ditandai dalam histori |
| Duplikasi harian | Satu atau banyak Inspector per tanggal belum diatur | Unik per proyek/tanggal/pembuat; revisi tetap satu identitas logis |
| Role global/proyek | Role pengguna dan role penugasan keduanya ada | Role global membatasi kemampuan, penugasan aktif membatasi proyek; Admin lintas proyek tanpa approval teknis |
| Owner/Pengguna | Tabel mengizinkan Lihat pengguna | Hanya profil/direktori tim proyek yang boleh diakses; tidak membocorkan akun seluruh sistem |
| Engineer | Catatan teknis disebut, schema belum ada | Tambahkan catatan/pemeriksaan teknis terkait laporan/kegiatan; tanpa approval akhir |
| Status proyek | Otomatis dengan koreksi manual | Simpan status hitungan, override, alasan dan pelaku; jelaskan aturan pada tahap proyek |
| Rekap tenaga kerja | Per jenis dan jam tetapi agregasi belum rinci | Pisahkan jumlah per hari, orang-hari dan orang-jam; jangan menyebut penjumlahan harian sebagai orang unik |
| Template ekspor | Workbook tersedia sejak T00, belum dianalisis rinci | Gunakan sebagai referensi format pada T10; kesamaan belum diklaim |

## Implikasi model data

Gunakan tabel yang disarankan PRD dengan relasi dan constraint nyata; jangan menyalin spreadsheet sebagai schema. Tambahkan hanya field yang diperlukan workflow:

- `users`/`project_members`: status aktif, cakupan role, tanggal penugasan; `projects`: alamat instansi yang disebut §8, metadata koreksi status, zona waktu.
- `work_items`: parent/kelompok, basis volume-harga-bobot, larangan siklus dan hubungan lintas proyek, perlindungan data yang sudah dirujuk.
- Versi rencana: identitas baseline, status publikasi, nomor unik, tanggal berlaku, granularitas sumber, item serta basis perhitungan yang dipakai.
- Laporan: pembuat, nomor revisi, hubungan revisi asal, status dan audit; child tenaga kerja, cuaca, aktivitas, material/alat, masalah, foto.
- Lengkapi field bisnis yang tidak ada di contoh schema: tanggal penerimaan material, tanggal masalah, identitas tenaga kerja opsional, lokasi foto dan relasi kegiatan, hasil pemeriksaan/catatan Engineer.
- Persetujuan dan progress: pemeriksa, keputusan, alasan, kontribusi dengan rujukan kegiatan/revisi dan basis; unik untuk mencegah posting ganda.
- `report_periods`: batas tanggal yang konsisten. Agregat progress adalah hasil dari sumber sah, bukan angka yang diedit terpisah.
- Riwayat perubahan sederhana untuk data penting dan log revisi; tidak perlu event sourcing untuk seluruh aplikasi.

## Risiko yang perlu ditutup oleh tes

Prioritas tertinggi adalah kebocoran data lintas proyek, persetujuan oleh role yang salah, perhitungan ganda, salah skala persen, double count induk-anak, dan histori aktual berubah setelah revisi rencana. Selanjutnya uji batas periode, koreksi laporan, persetujuan bersamaan, kesamaan angka web/ekspor, serta validasi unggahan.

## Arah arsitektur

Gunakan satu repository TypeScript dengan batas frontend/API/service/data yang jelas; boleh satu deployment dengan modul backend terpisah. Database relasional menjadi satu sumber data. Pemilihan framework, driver/ORM, database lokal, pustaka grafik, dan generator ekspor dilakukan pada T00 setelah memeriksa runtime yang tersedia serta dokumentasi resmi saat implementasi. Hindari menjadikan layanan cloud berbayar prasyarat demo.

Pembagian service yang disarankan: akses proyek, pekerjaan/bobot, periode, rencana, laporan/pemeriksaan, progress, laporan/ekspor. Ini pemisahan kode dan tanggung jawab, bukan permintaan microservices.
