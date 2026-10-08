# Penjelasan Rumus Bobot, Kemajuan, dan Kurva-S

Dokumen ini menjelaskan lokasi rumus yang digunakan SIMP dan cara kerjanya dengan bahasa sederhana. Rumus utama dijalankan di backend. Halaman frontend hanya menampilkan hasilnya sebagai angka, tabel, dan grafik.

## Gambaran singkat

Alur perhitungannya adalah:

```text
Volume kontrak × harga satuan
              ↓
       Nilai pekerjaan
              ↓
   Dibandingkan total nilai proyek
              ↓
        Bobot pekerjaan
              ↓
Target waktu + laporan yang disetujui
              ↓
   Target dan kemajuan aktual proyek
              ↓
            Kurva-S
```

Ada tiga angka yang harus dibedakan:

1. **Kemajuan fisik pekerjaan** menunjukkan berapa persen volume satu pekerjaan sudah selesai.
2. **Bobot pekerjaan** menunjukkan seberapa besar nilai pekerjaan tersebut dibandingkan seluruh nilai pekerjaan proyek.
3. **Kontribusi kemajuan** menunjukkan pengaruh kemajuan satu pekerjaan terhadap kemajuan seluruh proyek.

## Lokasi file perhitungan

| Kebutuhan | File utama | Isi perhitungan |
| --- | --- | --- |
| Nilai dan bobot pekerjaan | `server/services/work-calculation.ts` | Nilai pekerjaan, total nilai, bobot item, bobot kelompok, dan pembulatan tampilan. |
| Validasi volume dan harga | `shared/work-items.ts` | Batas angka volume, harga satuan, serta tipe data pekerjaan. |
| Pembagian minggu dan bulan proyek | `shared/plans.ts` | Tanggal mulai–akhir periode, jumlah hari, minggu ke-, dan bulan ke-. |
| Validasi rencana | `server/services/plans.ts` | Memastikan semua pekerjaan mempunyai target dan jumlah target setiap pekerjaan tepat 100%. |
| Target rencana per periode | `server/services/plan-calculation.ts` | Mengubah target pekerjaan menjadi target tertimbang proyek dan membaginya secara harian. |
| Kemajuan aktual dan selisih | `server/services/progress-calculation.ts` | Volume aktual, kemajuan fisik, kontribusi aktual, target, dan selisih. |
| Sumber data serta titik kurva-S | `server/services/progress.ts` | Membaca sumber laporan yang sah dan membentuk titik kurva Rencana Awal, rencana pembanding, dan aktual. |
| Ringkasan dashboard | `server/services/monitoring.ts` | Memakai hasil service kemajuan untuk dashboard dan monitoring. |
| Tampilan grafik | `client/src/pages/MonitoringViews.tsx` | Menggambar hasil perhitungan backend. Tidak menentukan bobot atau kemajuan resmi. |

Contoh pengujian rumus terdapat di:

- `tests/work-calculation.test.ts`
- `tests/plans-calculation.test.ts`
- `tests/progress-calculation.test.ts`

## 1. Menentukan nilai pekerjaan

Nilai setiap item pekerjaan dihitung dari volume kontrak dan harga satuannya.

```text
Nilai pekerjaan = Volume kontrak × Harga satuan
```

Contoh:

```text
Pekerjaan       : Galian tanah
Volume kontrak  : 1.000 m³
Harga satuan    : Rp100.000

Nilai pekerjaan = 1.000 × Rp100.000
                 = Rp100.000.000
```

Kelompok pekerjaan tidak mempunyai volume dan harga sendiri. Nilai kelompok adalah jumlah nilai seluruh pekerjaan di bawah kelompok tersebut.

## 2. Menentukan bobot pekerjaan

Bobot menunjukkan bagian nilai suatu pekerjaan terhadap total nilai semua item pekerjaan.

```text
Bobot pekerjaan = Nilai pekerjaan ÷ Total nilai semua pekerjaan × 100%
```

Contoh dua pekerjaan:

| Pekerjaan | Volume | Harga satuan | Nilai | Bobot |
| --- | ---: | ---: | ---: | ---: |
| Galian | 1.000 m³ | Rp100.000 | Rp100.000.000 | 10% |
| Pemasangan pipa | 9.000 m | Rp100.000 | Rp900.000.000 | 90% |
| **Total** |  |  | **Rp1.000.000.000** | **100%** |

Perhitungan bobot Galian:

```text
Rp100.000.000 ÷ Rp1.000.000.000 × 100% = 10%
```

Perhitungan bobot Pemasangan pipa:

```text
Rp900.000.000 ÷ Rp1.000.000.000 × 100% = 90%
```

### Aturan bobot di SIMP

- Bobot resmi dihitung dari angka presisi penuh, bukan dari angka dua desimal yang terlihat di layar.
- Tampilan ringkas memakai dua desimal. Rincian perhitungan dapat memakai enam desimal.
- Bobot kelompok adalah jumlah bobot turunannya.
- Kelompok tidak dijumlahkan lagi ke total proyek agar bobot tidak menjadi ganda.
- Jika total nilai semua item masih nol, bobot belum dapat dihitung.
- Status aktif atau nonaktif tidak mengubah basis nilai kontrak yang sudah ditetapkan.

## 3. Menentukan kemajuan fisik pekerjaan

Kemajuan fisik membandingkan volume yang sudah disetujui dengan volume kontrak pekerjaan tersebut.

```text
Kemajuan fisik = Volume aktual kumulatif ÷ Volume kontrak × 100%
```

Contoh pekerjaan Galian:

```text
Volume kontrak          = 1.000 m³
Volume yang disetujui   = 250 m³

Kemajuan fisik          = 250 ÷ 1.000 × 100%
                         = 25%
```

Angka 25% tersebut adalah kemajuan **pekerjaan Galian**, bukan kemajuan seluruh proyek.

## 4. Mengubah kemajuan fisik menjadi kemajuan proyek

Kontribusi pekerjaan terhadap proyek dihitung menggunakan bobot pekerjaan.

```text
Kontribusi kemajuan = Kemajuan fisik × Bobot pekerjaan ÷ 100
```

Jika bobot Galian 10% dan kemajuan fisiknya 25%:

```text
Kontribusi Galian = 25% × 10% ÷ 100
                  = 2,5%
```

Artinya, Galian menyumbang **2,5 poin persentase** kepada kemajuan proyek.

Kemajuan aktual proyek adalah jumlah kontribusi seluruh item pekerjaan:

```text
Kemajuan proyek = Kontribusi pekerjaan A
                + Kontribusi pekerjaan B
                + Kontribusi pekerjaan lainnya
```

Secara matematis, SIMP juga dapat menghitung kontribusi yang sama langsung dari nilai volume aktual:

```text
Kontribusi = Volume aktual × Harga satuan ÷ Total nilai proyek × 100%
```

## 5. Sumber kemajuan aktual

Kemajuan aktual hanya menggunakan kegiatan ber-volume dari laporan yang sudah disetujui dan masih menjadi versi resmi.

Urutannya:

```text
Inspector mengisi volume kegiatan
              ↓
Laporan dikirim untuk diperiksa
              ↓
Engineer dapat memberi catatan teknis
              ↓
Team Leader menyetujui laporan
              ↓
Volume masuk ke kemajuan aktual
```

Ketentuan penting:

- Draf, laporan yang baru dikirim, atau laporan yang perlu diperbaiki belum menambah kemajuan resmi.
- Catatan kegiatan tanpa volume tidak menambah kemajuan.
- Volume kumulatif tidak boleh melebihi volume kontrak.
- Satu kegiatan tidak boleh dihitung dua kali.
- Jika laporan disetujui kemudian dikoreksi, versi lama tetap berlaku sampai versi koreksi disetujui.
- Mengubah rencana hanya mengubah garis target. Perubahan rencana tidak mengubah volume aktual yang sudah sah.

## 6. Menentukan target rencana

Pada menu **Jadwal & Target**, setiap item pekerjaan diberi target per minggu atau per bulan.

Jumlah target seluruh periode untuk **setiap pekerjaan** harus tepat 100%.

Contoh:

| Pekerjaan | Minggu 1 | Minggu 2 | Minggu 3 | Total |
| --- | ---: | ---: | ---: | ---: |
| Galian | 20% | 30% | 50% | 100% |
| Pemasangan pipa | 10% | 30% | 60% | 100% |

Target tersebut menjelaskan rencana penyelesaian masing-masing pekerjaan. Target proyek kemudian dihitung dengan bobot pekerjaan.

```text
Target proyek per periode = Jumlah(Bobot pekerjaan × Target pekerjaan periode ÷ 100)
```

Dengan bobot Galian 10% dan Pipa 90%:

| Periode | Galian | Pipa | Target proyek periode | Target kumulatif |
| --- | ---: | ---: | ---: | ---: |
| Minggu 1 | 10% × 20% = 2% | 90% × 10% = 9% | 11% | 11% |
| Minggu 2 | 10% × 30% = 3% | 90% × 30% = 27% | 30% | 41% |
| Minggu 3 | 10% × 50% = 5% | 90% × 60% = 54% | 59% | 100% |

## 7. Bagaimana kurva-S dibuat

Kurva-S menampilkan hubungan antara waktu dan kemajuan kumulatif.

- Sumbu mendatar menunjukkan tanggal atau periode proyek.
- Sumbu tegak menunjukkan persentase kumulatif dari 0% sampai 100%.
- Garis **Rencana Awal** berasal dari target kumulatif Rencana Awal.
- Garis **Rencana pembanding** berasal dari versi rencana terbaru atau versi yang dipilih.
- Garis **Aktual** berasal dari laporan disetujui sampai tanggal yang dipilih.

Menggunakan contoh sebelumnya, titik garis target adalah:

```text
Sebelum proyek : 0%
Akhir Minggu 1 : 11%
Akhir Minggu 2 : 41%
Akhir Minggu 3 : 100%
```

Titik-titik tersebut dihubungkan sehingga menjadi kurva target. Aktual dibuat dengan cara yang sama memakai kemajuan resmi pada setiap tanggal kurva.

### Mengapa bentuknya disebut kurva-S?

Pada banyak proyek konstruksi, pekerjaan biasanya:

1. bergerak lambat saat persiapan,
2. meningkat cepat saat pekerjaan utama berjalan,
3. melambat lagi ketika penyelesaian dan pemeriksaan akhir.

Pola kumulatif itu sering menyerupai huruf S. Namun SIMP tidak memaksa grafik selalu berbentuk S. Bentuk grafik mengikuti target yang dimasukkan dan kemajuan aktual proyek.

## 8. Target pada tanggal di tengah periode

SIMP membagi target satu periode secara merata berdasarkan jumlah hari dalam periode tersebut. Ini digunakan ketika pengguna memilih tanggal yang belum mencapai akhir minggu atau bulan.

Contoh target Minggu 1 adalah 14% selama 7 hari. Pada akhir hari ke-3:

```text
Target sampai hari ke-3 = 14% × 3 ÷ 7
                        = 6%
```

Cara ini juga membuat target tetap konsisten saat rencana mingguan ditampilkan sebagai laporan bulanan, atau sebaliknya. **Versi rencana yang sudah terbit sebelum migration 010** tetap memakai blok tujuh hari sejak tanggal mulai proyek. **Versi yang terbit setelahnya** memakai minggu Senin–Minggu: minggu pertama dimulai pada tanggal mulai proyek dan berakhir pada hari Minggu terdekat; minggu terakhir dipotong pada tanggal selesai proyek. Aturan minggu tersimpan pada tiap versi, sehingga angka versi lama tidak ditafsirkan ulang.

Contoh proyek mulai Kamis, 16 Juli 2026 dan selesai Sabtu, 12 Desember 2026: Minggu 1 adalah 16–19 Juli (4 hari), Minggu 2 adalah 20–26 Juli, dan Minggu 22 adalah 7–12 Desember (6 hari). Target 50% pada Minggu 1 dan 50% pada Minggu 22 berarti dua alokasi fisik pada periode tersebut; kontribusi ke target proyek masih dikalikan bobot pekerjaan.

Pada proyek contoh tersebut, **V2 Koreksi target workbook TS** berlaku sejak 8 Oktober 2026. Sebanyak 25 dari 38 isian target pekerjaan diperbaiki dari sheet TS; misalnya I.2 Mobilisasi dan Demobilisasi menjadi 50% pada Minggu 1 dan 50% pada Minggu 22. V1 Rencana Awal tetap tersedia untuk membaca tanggal sebelum V2 berlaku. Satuan, volume, harga, jumlah harga, dan bobot pekerjaan tidak diubah oleh koreksi rencana ini.

## 9. Membaca selisih terhadap target

```text
Selisih = Kemajuan aktual kumulatif − Target kumulatif
```

Contoh:

```text
Aktual = 35%
Target = 40%

Selisih = 35% − 40%
         = -5 poin persentase
```

Maknanya:

- Nilai negatif: aktual berada di bawah target.
- Nilai nol: aktual sama dengan target.
- Nilai positif: aktual berada di atas target.

Satuan yang benar adalah **poin persentase**. Selisih dari 35% ke 40% adalah 5 poin persentase.

## 10. Cara praktis menyusun bobot dan kurva-S

### Menyiapkan bobot

1. Buka **Daftar Pekerjaan**.
2. Pastikan setiap item memiliki volume kontrak, satuan, dan harga satuan yang benar.
3. Periksa nilai pekerjaan yang dihitung aplikasi.
4. Pastikan total nilai pekerjaan sesuai nilai dasar yang ingin digunakan.
5. Periksa bobot setiap item dan total bobot 100%.
6. Setelah benar, lanjutkan ke **Jadwal & Target**.

Team Leader tidak perlu mengetik bobot secara manual. SIMP menghitung bobot dari volume dan harga satuan.

### Menyusun kurva target

1. Tentukan kapan setiap pekerjaan secara nyata dapat dimulai.
2. Bagi target pekerjaan ke minggu atau bulan pelaksanaannya.
3. Pastikan total target setiap pekerjaan tepat 100%.
4. Hindari membagi target secara rata jika kondisi lapangan memang tidak rata.
5. Periksa target kumulatif proyek yang dihasilkan.
6. Tetapkan Rencana Awal setelah daftar pekerjaan dan target sudah benar.

### Memperbarui garis aktual

1. Inspector mengisi volume kegiatan pada Laporan Harian.
2. Lampirkan foto sesuai ketentuan laporan.
3. Kirim laporan untuk diperiksa.
4. Team Leader menyetujui laporan yang benar.
5. Buka **Ringkasan** atau **Rincian kemajuan** untuk melihat garis aktual terbaru.

## 11. Contoh ringkas dari awal sampai kurva

```text
Galian:
  Nilai             = Rp100.000.000
  Bobot              = 10%
  Volume selesai     = 250 dari 1.000 m³
  Kemajuan fisik     = 25%
  Kontribusi aktual  = 2,5%

Pipa:
  Nilai             = Rp900.000.000
  Bobot              = 90%
  Volume selesai     = 1.800 dari 9.000 m
  Kemajuan fisik     = 20%
  Kontribusi aktual  = 18%

Kemajuan proyek      = 2,5% + 18%
                     = 20,5%

Jika target hari ini = 25%
Selisih              = 20,5% − 25%
                     = -4,5 poin persentase
```

Angka **20,5%** menjadi titik aktual pada tanggal tersebut. Angka **25%** menjadi titik target. Keduanya ditampilkan pada kurva-S untuk memperlihatkan apakah proyek berada di bawah, sama dengan, atau di atas rencana.

## Catatan presisi

SIMP menyimpan dan menghitung nilai dengan bilangan berskala serta pecahan agar hasil antarhalaman konsisten. Ringkasan biasanya menampilkan dua desimal agar mudah dibaca. Rincian teknis dapat menampilkan enam desimal. Pembulatan tampilan tidak digunakan kembali sebagai dasar perhitungan berikutnya.
