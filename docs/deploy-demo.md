# Demo SIMP dengan Supabase dan Vercel

Panduan ini untuk **trial demo**, belum untuk production. Supabase menyimpan data PostgreSQL dan foto; Vercel menayangkan frontend serta menjalankan API. Data PostgreSQL lokal tetap terpisah. Jangan mengunggah `.env`, `.env.demo`, password, connection string, atau secret key ke Git.

## Kondisi database demo

Proyek Supabase dan bucket privat `simp-report-photos` sudah dibuat. Sepuluh migration telah diterapkan lewat Session pooler, dan satu Administrator awal sudah dibuat. Pemeriksaan terakhir mencatat **0 proyek, 0 laporan, dan 0 foto**. Ini berarti aplikasi siap diisi melalui UI setelah deployment, tanpa memindahkan data lokal. Tidak perlu menjalankan bootstrap lagi. Migration berikutnya tetap dijalankan dari CLI yang tersedia, bukan saat Vercel Function mulai.

## 1. Siapkan repository untuk Vercel

Kode sudah memiliki `api/index.ts` untuk API Fastify, `vercel.json` untuk meneruskan `/api/*` ke Function dan route lain ke frontend Vite, serta adapter foto ke Supabase Storage privat. `npm run build` menghasilkan `dist/client`. Foto besar dikompresi di browser sebelum dikirim agar berada di bawah batas body Vercel 4,5 MB. Berkas foto tetap dibaca melalui API dengan pemeriksaan izin SIMP; bucket tidak perlu dibuat public.

Pastikan perubahan kode ini telah diunggah ke repository Git yang akan dihubungkan ke Vercel. File rahasia tetap hanya berada di komputer Anda atau di Environment Variables Vercel.

## 2. Buat proyek Vercel

1. Di Vercel, pilih **Add New → Project**, lalu impor repository SIMP.
2. Pilih **Root Directory** pada root repository yang berisi `package.json` dan `vercel.json`.
3. Gunakan **Node.js 24.x** di pengaturan proyek. Framework dapat dideteksi sebagai Vite.
4. Periksa **Build Command** `npm run build` dan **Output Directory** `dist/client`. Nilai ini juga tercatat di `vercel.json`.
5. **Sebelum deploy**, isi Environment Variables berikut. Gunakan contoh nama variabel di `vercel.env.example`; jangan unggah file itu sebagai berkas rahasia.

| Nama variabel | Cara mengisinya |
|---|---|
| `DATABASE_URL` | Connection string **Transaction pooler** Supabase, port **6543**, untuk proyek demo yang sudah dimigrasi. Password dalam URL harus di-*percent-encode*. Gunakan username `postgres.<project-ref>` sesuai panel **Connect** Supabase. |
| `DATABASE_CA_BASE64` | Isi Base64 dari sertifikat CA Supabase `data/supabase-ca.crt`. Di PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path 'data/supabase-ca.crt')))`; salin hasilnya hanya ke Vercel, jangan ke Git/chat. |
| `DATABASE_SCHEMA` | `public` |
| `PROJECT_TIMEZONE` | `Asia/Jakarta` |
| `APP_ORIGINS` | URL HTTPS Vercel yang akan dipakai, tanpa garis miring di akhir, misalnya `https://nama-proyek.vercel.app`. Jika memakai domain tambahan, pisahkan dengan koma. |
| `COOKIE_SECURE` | `true` |
| `SUPABASE_URL` | URL proyek Supabase yang sama, misalnya `https://PROJECT_REF.supabase.co`. |
| `SUPABASE_SECRET_KEY` | **Secret key server-side** dari Supabase **Settings → API Keys**. Gunakan key `sb_secret_...` bila tersedia; jangan gunakan publishable/anon key. |
| `SUPABASE_STORAGE_BUCKET` | `simp-report-photos` |
| `LOG_LEVEL` | `info` |

Atur variabel untuk environment Vercel yang hendak dipakai. **Preview** dapat mempunyai domain berbeda; tambahkan domain preview yang memang diuji ke `APP_ORIGINS`, atau gunakan domain demo tetap agar login melalui cookie berhasil. Setelah mengubah Environment Variables, buat deployment baru agar nilai terbaru dipakai. Jangan memakai awalan `VITE_` untuk password, URL database, atau secret key karena itu dapat masuk ke bundle browser.

`DEMO_DATABASE_URL`, `DEMO_DB_SESSION_HOST`, dan `BOOTSTRAP_ADMIN_*` hanya untuk CLI lokal; jangan masukkan ke Vercel. Sertifikat asli `.crt` juga tidak perlu diunggah sebagai file karena Function memakai `DATABASE_CA_BASE64`.

## 3. Deploy dan periksa

Sesudah variabel lengkap, deploy proyek. Buka `https://<domain-demo>/api/health`; respons siap harus berstatus **200**. Buka `https://<domain-demo>/api/auth/me` tanpa login; **401** adalah respons yang benar dan membuktikan API terjangkau. Kemudian masuk dengan akun Administrator demo, buat satu proyek melalui UI, dan buat akun role lain sesuai kebutuhan.

Sebelum membagikan demo, periksa login dan hak akses lima role, laporan Inspector dan foto, pemeriksaan Engineer, persetujuan Team Leader, kemajuan, PDF/Excel, refresh pada URL halaman dalam, serta tampilan HP. Periksa khusus satu unggahan foto besar dan satu ekspor dengan data realistis. **PDF/Excel yang lebih besar dari batas respons Vercel 4,5 MB mungkin belum dapat diunduh melalui Function**; jika itu terjadi, perlu mekanisme unduhan lain sebelum memakai dataset besar. Jangan mengubah izin bucket menjadi public untuk mengatasi masalah unduhan.

## Validasi lokal yang sudah dilakukan

`npm run build` dan 79 tes backend terkompilasi lulus. Transaction pooler Supabase berhasil dihubungi baca-saja dengan TLS dan CA. Adapter API diuji lokal: `/api/health` dan path rewrite menghasilkan 200, sedangkan `/api/auth/me` tanpa sesi menghasilkan 401. Tes browser laporan desktop/HP lulus, termasuk unggah foto sumber lebih dari 2,8 MiB yang dikompresi dan dibuka ulang. Tes Storage memakai mock privat; **akses bucket nyata dan deployment Vercel belum diuji**. Database demo dan data lokal tidak direset.

Password database yang pernah terkirim melalui percakapan sebaiknya diganti di Supabase sebelum demo dibagikan; sesudahnya perbarui `.env.demo` dan `DATABASE_URL` Vercel secara privat.

## Rujukan

- [Vercel untuk Vite](https://vercel.com/docs/frameworks/frontend/vite), [Vercel Functions Node.js](https://vercel.com/docs/functions/runtimes/node-js), dan [batas Functions](https://vercel.com/docs/functions/limitations).
- [Pilihan koneksi PostgreSQL Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres), [akses bucket privat](https://supabase.com/docs/guides/storage/security/access-control), dan [API keys](https://supabase.com/docs/guides/getting-started/api-keys).
