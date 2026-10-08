# Kontrak domain SIMP

PRD proyek tetap menjadi sumber kebutuhan. Aturan bertanda **asumsi** adalah keputusan awal prototype yang harus dicatat dalam dokumen keputusan proyek dan ditinjau bila pengguna memberi aturan lain. Jangan memakai referensi ini untuk mengganti persyaratan baru.

## Angka dan sumber data

- Gunakan decimal atau bilangan berskala untuk uang, volume, dan persentase; pembulatan tampilan tidak menjadi input perhitungan berikutnya.
- Simpan persentase dengan satuan angka 0–100 secara konsisten: `itemAmount = contractQuantity × unitPrice`; `weightPct = itemAmount / sumLeafAmounts × 100`; `physicalPct = cumulativeApprovedQuantity / contractQuantity × 100`; `weightedPct = physicalPct × weightPct / 100`.
- Total progress = jumlah weightedPct pekerjaan daun, tidak menjumlah ulang nilai kelompok/induk. Tolak siklus parent dan relasi lintas proyek.
- Total nilai nol menghasilkan keadaan belum dapat dihitung, bukan NaN/Infinity. Item volume nol tidak menjadi pembagi; kegiatan naratif tetap boleh dicatat tetapi tidak menambah progress kuantitatif.
- **Asumsi:** bobot otomatis, tanpa editor bobot manual; peringatan jika selisih total dari 100 melebihi 0,01 poin persentase. Angka presisi penuh tetap dipakai untuk agregasi.
- **Asumsi:** volume aktual yang melebihi volume kontrak tidak dipotong diam-diam; tampilkan kesalahan saat pengiriman/persetujuan dan minta koreksi. Penyesuaian kontrak memerlukan desain versi tersendiri, bukan perubahan denominator diam-diam.
- Pilihan `MANUAL` di contoh schema PRD bukan kewajiban menyediakan input progress bebas. Untuk prototype, sumber resmi adalah laporan disetujui dan koreksi terversi yang disetujui.

## Periode

- Tanggal laporan adalah tanggal bisnis tanpa konversi UTC yang menggeser hari; timestamp audit memiliki zona waktu yang jelas. **Asumsi awal:** zona waktu proyek Asia/Jakarta, dapat dikonfigurasi; tidak mengambil zona waktu mesin secara implisit.
- `dayNumber = selisihHari(tanggalLaporan, tanggalMulai) + 1` dan `weekNumber = floor((dayNumber - 1) / 7) + 1`.
- Batas minggu ke-n: tanggal mulai + 7×(n−1), sampai minimum(tanggal mulai + 7×n−1, tanggal selesai), inklusif.
- **Asumsi:** bulan proyek dihitung dari tanggal mulai ditambah bulan kalender dengan tanggal di-clamp ke akhir bulan; hitung setiap batas dari tanggal mulai asli agar tidak bergeser setelah Februari. Akhir periode adalah sehari sebelum batas berikutnya, dipotong tanggal selesai. Bukan blok 30 hari dan bukan otomatis tanggal 1.
- Durasi inklusif; **asumsi** sisa hari setelah tanggal laporan = maksimum(tanggal selesai − tanggal laporan, 0). Tolak laporan di luar rentang pelaksanaan sampai tanggal proyek direvisi secara eksplisit.
- Contoh minggu: mulai 16 Juli 2026 → minggu 1 = 16–22 Juli; 23 Juli = hari 8/minggu 2. Bulan 1 = 16 Juli–15 Agustus.
- Query periode: sebelumnya = tanggal < awal; berjalan = awal ≤ tanggal ≤ akhir; kumulatif = sebelumnya + berjalan. Jangan menjumlah nilai kumulatif antar periode.

## Rencana dan target

- Rencana Awal merupakan identitas versi pertama yang permanen, bukan status yang hilang saat versi lain aktif. Pisahkan identitas baseline dari status publikasi/keaktifan dalam schema.
- Nomor versi unik per proyek. Publikasi versi beserta itemnya transaksional. Versi terbit tidak diedit; perubahan menghasilkan versi baru dengan alasan, pembuat, waktu, effective_date, dan daftar perubahan.
- **Asumsi:** saat cutoff D, rencana berlaku adalah versi terbit dengan effective_date ≤ D yang paling akhir. Versi masa depan belum aktif. Tolak tanggal berlaku duplikat atau backdate yang menimpa periode yang sudah berlaku; perubahan jadwal berikutnya tetap boleh.
- Bedakan kurva versi yang dipilih pengguna dari pemilihan versi otomatis per tanggal; tampilkan nama versi dan tanggal berlaku agar angka dapat ditelusuri.
- **Asumsi:** editor target mingguan dan bulanan tersedia. Dalam satu versi pilih satu granularitas sebagai sumber, granularitas lain diturunkan dari alokasi per tanggal. Distribusi merata dalam periode adalah default eksplisit. Editing granularitas lain membuat draf versi baru; hindari dua jadwal independen yang bertentangan.
- Target incremental per pekerjaan dijumlah menjadi kumulatif; target akhir pekerjaan 100% dan total tertimbang proyek 100%, dengan validasi presisi yang disepakati.
- **Asumsi pembatas prototype:** setelah Rencana Awal terbit, volume kontrak, harga, bobot, unit, dan struktur pekerjaan yang menjadi basis perhitungan dibekukan. Revisi rencana mengubah jadwal/target, bukan basis perhitungan. Perubahan nilai kontrak berjalan adalah metadata berjejak dan tidak otomatis mengubah bobot.
- Bila perubahan lingkup kontrak diminta, perluas dengan versi basis pekerjaan dan cut-off eksplisit; jangan membuka edit biasa yang mengubah sejarah. Simpan basis/rujukan basis pada progress agar angka dapat diaudit.

## Laporan dan koreksi

Transisi resmi:

| Dari | Aksi | Ke | Pelaku |
| --- | --- | --- | --- |
| Belum Dikirim | Kirim untuk Diperiksa | Menunggu Pemeriksaan | Pembuat yang berhak |
| Menunggu Pemeriksaan | Minta Perbaikan + alasan | Perlu Diperbaiki | Team Leader proyek |
| Perlu Diperbaiki | Perbaiki lalu kirim ulang | Menunggu Pemeriksaan | Pembuat yang berhak |
| Menunggu Pemeriksaan | Setujui | Sudah Disetujui | Team Leader proyek |

- Laporan menunggu pemeriksaan dikunci dari perubahan isian; laporan disetujui immutable. UI dan API mengikuti aturan yang sama.
- **Asumsi:** satu laporan logis per proyek + tanggal + pembuat; beberapa Inspector diperbolehkan. Revisi memakai identitas laporan yang sama dengan nomor revisi, bukan laporan baru yang ikut dihitung dua kali.
- Team Leader dapat membuat/mengelola laporan sesuai tabel hak akses PRD §58; rekam pembuat dan pemeriksa. Jangan menambahkan pemisahan petugas wajib yang tidak diminta PRD.
- Koreksi laporan disetujui membuat revisi turunan beralasan. Versi lama masih sah selama koreksi belum disetujui. Saat persetujuan koreksi, ganti kontribusi resmi secara atomik, simpan versi lama dan peristiwa audit.
- Akun atau penugasan nonaktif tidak boleh menulis/menyetujui. Administrator dapat melihat laporan tetapi tidak mendapat hak persetujuan teknis.
- Engineer dapat memberi catatan/hasil pemeriksaan teknis tanpa mengubah status persetujuan akhir. Owner hanya membaca laporan disetujui serta foto/laporan turunannya.

## Posting progress, keterlambatan, dan histori

- Persetujuan, penetapan versi laporan yang sah, dan posting progress berada dalam satu transaksi. Gunakan constraint unik sumber kegiatan + revisi dan proteksi konkurensi; klik ganda hanya memiliki satu efek.
- Query progress memakai kontribusi dari revisi sah saja. Jangan menghitung jurnal mentah dan snapshot agregat sekaligus. `progress_records` boleh berupa materialisasi/cache yang dapat dibangun ulang, bukan input bisnis kedua.
- **Asumsi:** laporan terlambat disetujui masuk ke tanggal kegiatan. Tampilan terkini periode lama dapat berubah karena persetujuan terlambat atau koreksi sah, dengan audit. Revisi rencana sendiri sama sekali tidak mengubah aktual.
- Simpan waktu pembuatan ekspor, cutoff, versi rencana, dan revisi sumber agar hasil yang pernah diterbitkan dapat dijelaskan; tidak perlu membangun sistem penutupan buku enterprise.
- Pembaruan progress membatalkan cache turunan periode terdampak. Perbandingan sebelum/sesudah perubahan rencana harus membuktikan volume dan aktual tetap sama.

## Contoh hasil untuk pengujian

| Kasus | Hasil yang wajib |
| --- | --- |
| Kontrak 1.000 m³; aktual disetujui 250 m³; bobot 10% | Fisik 25%; kontribusi proyek 2,5% |
| Sebelumnya 100 m³, periode berjalan 150 m³, basis sama | Fisik 10%, 15%, kumulatif 25%; tertimbang 1%, 1,5%, 2,5% |
| Tambahan 100 m³ masih menunggu pemeriksaan | Aktual sah tetap 250 m³ |
| Persetujuan permintaan yang sama dikirim dua kali | Kontribusi tetap satu kali |
| Revisi 250 m³ menjadi 200 m³ disetujui | Kontribusi 2%; versi lama tersimpan; bukan 4,5% |
| Aktual 42%, target 45% | Selisih −3 poin persentase; UI mengikuti istilah PRD |
| Rencana V2 berlaku setelah minggu 3 | Aktual minggu 1–3 tidak berubah |
| Kelompok berisi dua daun | Nilai induk tidak masuk total untuk kedua kalinya |

Uji juga penolakan akses lintas proyek, perubahan role pada payload frontend, foto laporan belum disetujui oleh Owner, batas bulan/tahun/kabisat, hari terakhir, pembagi nol, dan approval bersamaan.
