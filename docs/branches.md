# Branch pengembangan SIMP

| Branch | Kegunaan | Backend dan foto |
| --- | --- | --- |
| `main` | Pengembangan dan penggunaan lokal | Server Node.js, PostgreSQL lokal, `storage/uploads` |
| `demo` | Trial demo di Vercel | Vercel Function, PostgreSQL dan Storage Supabase |

Kedua branch memakai model data dan fitur SIMP yang sama. Migration database tetap ada di keduanya. Rahasia dari `.env`, `.env.demo`, `data/`, dan `.tmp/` tidak masuk Git.

Untuk perubahan fitur bersama, buat commit yang terbatas pada fitur itu lalu bawa ke branch lain dengan `git cherry-pick <hash>` dan jalankan pemeriksaan pada masing-masing branch. Jangan gabungkan seluruh `main` ke `demo` atau sebaliknya, karena langkah itu dapat menghapus adapter deployment atau mengembalikan kode Supabase ke branch lokal.

Vercel Production harus menunjuk branch `demo` sebelum commit lokal berikutnya dikirim ke `main`. Perubahan pengaturan branch di Vercel memerlukan deployment ulang; periksa `/api/health` dan alur masuk sesudahnya.
