import { useState, type FormEvent } from 'react';
import type { SessionUser } from '../../../shared/contracts';
import { roleLabels } from '../../../shared/contracts';
import { api, ApiError } from '../api';
import { Feedback, PageHeader } from '../components/ui';

const guide: Record<SessionUser['role'], { title: string; description: string; href: string }[]> = {
  ADMINISTRATOR: [
    { title: 'Kelola pengguna', description: 'Buat akun, atur peran, dan periksa status pengguna.', href: '/pengguna' },
    { title: 'Kelola proyek', description: 'Buat proyek, tetapkan Team Leader, dan atur tim.', href: '/proyek' },
    { title: 'Periksa aktivitas', description: 'Telusuri perubahan penting dari seluruh proyek.', href: '/aktivitas' },
  ],
  TEAM_LEADER: [
    { title: 'Atur pekerjaan dan target', description: 'Buka proyek, susun pekerjaan, lalu terbitkan rencana.', href: '/proyek' },
    { title: 'Periksa laporan', description: 'Buka Laporan Harian pada proyek Anda untuk meninjau laporan yang dikirim.', href: '/proyek' },
    { title: 'Pantau aktivitas', description: 'Lihat perubahan pada proyek yang menjadi tanggung jawab Anda.', href: '/aktivitas' },
  ],
  ENGINEER: [
    { title: 'Periksa laporan', description: 'Buka Laporan Harian untuk memberi catatan teknis.', href: '/proyek' },
    { title: 'Pantau proyek', description: 'Lihat ringkasan, kemajuan, dan dokumentasi proyek penugasan.', href: '/proyek' },
  ],
  INSPECTOR: [
    { title: 'Buat laporan harian', description: 'Pilih proyek, isi kegiatan dan foto, periksa isian, lalu kirim.', href: '/proyek' },
    { title: 'Perbaiki laporan', description: 'Buka laporan yang berstatus Perlu Diperbaiki dan baca catatan pemeriksa.', href: '/proyek' },
  ],
  OWNER: [
    { title: 'Pantau kemajuan', description: 'Pilih proyek penugasan untuk melihat ringkasan dan capaian.', href: '/proyek' },
    { title: 'Baca laporan sah', description: 'Buka Laporan Harian atau Rekap & Unduhan untuk laporan yang disetujui.', href: '/proyek' },
  ],
};

async function imageData(file: File): Promise<{ mime: 'image/jpeg'; data: string }> {
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Pilih foto JPEG/PNG maksimal 10 MiB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 320;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Foto tidak dapat diproses.');
    const scale = Math.max(320 / image.naturalWidth, 320 / image.naturalHeight);
    const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
    context.fillStyle = '#fff'; context.fillRect(0, 0, 320, 320);
    context.drawImage(image, (320 - width) / 2, (320 - height) / 2, width, height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82));
    if (!blob) throw new Error('Foto tidak dapat diproses.');
    const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Foto tidak dapat dibaca.')); reader.readAsDataURL(blob); });
    return { mime: 'image/jpeg', data };
  } finally { URL.revokeObjectURL(url); }
}

export function Profile({ user, refreshSession }: { user: SessionUser; refreshSession: () => Promise<void> }) {
  const [name, setName] = useState(user.name), [currentPassword, setCurrentPassword] = useState(''), [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const run = async (task: string, work: () => Promise<void>, message: string) => {
    setBusy(task); setError(''); setSuccess('');
    try { await work(); await refreshSession(); setSuccess(message); }
    catch (reason) { setError(reason instanceof ApiError || reason instanceof Error ? reason.message : 'Perubahan belum berhasil.'); }
    finally { setBusy(''); }
  };
  const saveName = (event: FormEvent) => { event.preventDefault(); void run('name', async () => { await api('/api/profile', { method: 'PATCH', body: JSON.stringify({ name }) }); }, 'Nama akun telah diperbarui.'); };
  const savePassword = (event: FormEvent) => { event.preventDefault(); setBusy('password'); setError(''); setSuccess('');
    void api('/api/profile/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) })
      .then(() => window.location.assign('/masuk'))
      .catch(reason => { setError(reason instanceof Error ? reason.message : 'Kata sandi belum dapat diubah.'); setBusy(''); });
  };
  const savePhoto = (file?: File) => { if (!file) return; void run('photo', async () => {
    const data = await imageData(file);
    await api('/api/profile/photo', { method: 'POST', body: JSON.stringify(data) });
  }, 'Foto profil telah diperbarui.'); };
  return <div className="profile-page"><PageHeader eyebrow="Akun" title="Profil saya" description="Kelola identitas akun dan lihat panduan sesuai peran Anda." />
    {error && <Feedback error>{error}</Feedback>}{success && <Feedback>{success}</Feedback>}
    <div className="profile-layout"><div className="profile-main">
      <section className="profile-panel" aria-labelledby="profile-data-title"><h2 id="profile-data-title">Data akun</h2>
        <div className="profile-identity">{user.avatarUrl ? <img src={user.avatarUrl} alt="Foto profil Anda" /> : <span aria-hidden="true">{user.name.trim().charAt(0).toUpperCase()}</span>}
          <div><strong>{user.name}</strong><small>{roleLabels[user.role]} · {user.email}</small></div></div>
        <form onSubmit={saveName}><label htmlFor="profile-name">Nama lengkap</label><input id="profile-name" value={name} maxLength={120} onChange={event => setName(event.target.value)} required />
          <button disabled={!!busy || !name.trim()} type="submit">{busy === 'name' ? 'Menyimpan…' : 'Simpan nama'}</button></form>
        <div className="profile-photo-controls"><label htmlFor="profile-photo">Foto profil</label><p className="muted">JPEG atau PNG. Foto akan dipotong menjadi persegi dan disimpan secara privat.</p>
          <input id="profile-photo" type="file" accept="image/jpeg,image/png" disabled={!!busy} onChange={event => { savePhoto(event.target.files?.[0]); event.target.value = ''; }} />
          {user.avatarUrl && <button type="button" className="secondary" disabled={!!busy} onClick={() => void run('delete-photo', async () => { await api('/api/profile/photo', { method: 'DELETE' }); }, 'Foto profil telah dihapus.')}>Hapus foto</button>}
        </div>
      </section>
      <section className="profile-panel" aria-labelledby="profile-security-title"><h2 id="profile-security-title">Keamanan akun</h2><p className="muted">Setelah kata sandi diubah, semua sesi akan berakhir. Masuk kembali memakai kata sandi baru.</p>
        <form onSubmit={savePassword}><label htmlFor="profile-old-password">Kata sandi saat ini</label><input id="profile-old-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required />
          <label htmlFor="profile-new-password">Kata sandi baru</label><input id="profile-new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={event => setNewPassword(event.target.value)} required />
          <small>Minimal 12 karakter.</small><button type="submit" disabled={!!busy}>{busy === 'password' ? 'Mengubah…' : 'Ubah kata sandi'}</button></form>
      </section>
    </div><section className="profile-panel profile-guide" aria-labelledby="profile-guide-title"><h2 id="profile-guide-title">Panduan penggunaan</h2><p className="muted">Langkah awal untuk peran {roleLabels[user.role]}.</p>
      <ol>{guide[user.role].map(item => <li key={item.title}><div><strong>{item.title}</strong><p>{item.description}</p></div><a href={item.href}>Buka</a></li>)}</ol>
    </section></div></div>;
}
