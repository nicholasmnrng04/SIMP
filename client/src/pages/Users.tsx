import { useCallback, useEffect, useState } from 'react';
import Add from '@carbon/icons-react/es/Add.js';
import Edit from '@carbon/icons-react/es/Edit.js';
import type { ManagedUser, RoleCode, SessionUser } from '../../../shared/contracts';
import { roleCodes, roleLabels } from '../../../shared/contracts';
import { createUserSchema, updateUserSchema } from '../../../shared/validation';
import { api, ApiError } from '../api';
import { Feedback, Field, LoadingPanel, MetricTile, PageHeader, StatusTag, useConfirmAction } from '../components/ui';

function UserEditor({ user, onCancel, onSaved }: { user: ManagedUser | null; onCancel: () => void; onSaved: (user: ManagedUser) => Promise<void> }) {
  const [name, setName] = useState(user?.name ?? ''), [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<RoleCode>(user?.role ?? 'INSPECTOR'), [isActive, setActive] = useState(user?.isActive ?? true);
  const [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { confirm, confirmation } = useConfirmAction();
  const input = () => ({ name, email, role, isActive, ...(password || !user ? { password } : {}) });
  function validate(field?: string) {
    const result = (user ? updateUserSchema : createUserSchema).safeParse(input());
    const next: Record<string, string> = {};
    if (!result.success) for (const issue of result.error.issues) next[String(issue.path[0])] ??= issue.message;
    setErrors((previous) => field ? { ...previous, [field]: next[field] ?? '' } : next);
    return result.success;
  }
  return <><section className="editor-card" aria-labelledby="editor-title"><div className="section-heading"><div><p className="eyebrow">Data akun</p><h2 id="editor-title">{user ? 'Ubah Pengguna' : 'Tambah Pengguna'}</h2></div><button onClick={onCancel} disabled={busy}>Batal</button></div>
    {message && <Feedback error>{message}</Feedback>}
    <form noValidate onSubmit={async (event) => {
      event.preventDefault(); if (busy || !validate()) return;
      if (user && (user.role !== role || user.isActive !== isActive || password) && !(await confirm({ title: 'Simpan perubahan akses?', message: <>Semua sesi <strong>{user.name}</strong> akan diakhiri. Peran menjadi {roleLabels[role]} dan status akun menjadi {isActive ? 'Aktif' : 'Nonaktif'}.</>, confirmLabel: 'Simpan perubahan', danger: true }))) return;
      setBusy(true); setMessage('');
      try {
        const result = await api<{ user: ManagedUser }>(user ? `/api/users/${encodeURIComponent(user.id)}` : '/api/users', { method: user ? 'PATCH' : 'POST', body: JSON.stringify(input()) });
        await onSaved(result.user);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Data belum dapat disimpan.');
        if (error instanceof ApiError) setErrors(error.fields);
        setBusy(false);
      }
    }}><div className="form-grid">
      <Field id="user-name" label="Nama lengkap" error={errors.name}><input id="user-name" value={name} onChange={(e) => { setName(e.target.value); setErrors((previous) => ({ ...previous, name: '' })); }} onBlur={() => validate('name')} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'user-name-error' : undefined} disabled={busy} autoComplete="off" autoFocus /></Field>
      <Field id="user-email" label="Email" error={errors.email}><input id="user-email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((previous) => ({ ...previous, email: '' })); }} onBlur={() => validate('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'user-email-error' : undefined} disabled={busy} autoComplete="off" /></Field>
      <Field id="user-role" label="Peran pengguna" hint="Menentukan tindakan yang dapat dilakukan dalam aplikasi." error={errors.role}><select id="user-role" value={role} onChange={(e) => setRole(e.target.value as RoleCode)} disabled={busy} aria-describedby="user-role-hint">{roleCodes.map((value) => <option key={value} value={value}>{roleLabels[value]}</option>)}</select></Field>
      <Field id="user-password" label={user ? 'Kata sandi baru (opsional)' : 'Kata sandi awal'} hint={user ? 'Kosongkan untuk mempertahankan kata sandi. Minimal 12 karakter jika diganti.' : 'Minimal 12 karakter. Sampaikan secara pribadi kepada pemilik akun.'} error={errors.password}><input id="user-password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((previous) => ({ ...previous, password: '' })); }} onBlur={() => validate('password')} aria-invalid={!!errors.password} aria-describedby={`user-password-hint${errors.password ? ' user-password-error' : ''}`} autoComplete="new-password" disabled={busy} /></Field>
    </div><label className="checkbox-label"><input type="checkbox" checked={isActive} onChange={(e) => setActive(e.target.checked)} disabled={busy} />Akun aktif</label><p className="muted small">Akun nonaktif tidak dapat masuk atau menggunakan sesi sebelumnya.</p>
      <div className="form-actions"><button className="primary" disabled={busy} type="submit">{busy ? 'Menyimpan…' : user ? 'Simpan Perubahan' : 'Simpan Pengguna'}</button><button type="button" onClick={onCancel} disabled={busy}>Batal</button></div>
    </form></section>{confirmation}</>;
}

export function Users({ currentUser, refreshSession }: { currentUser: SessionUser; refreshSession: () => Promise<void> }) {
  const [users, setUsers] = useState<ManagedUser[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [feedback, setFeedback] = useState(''), [query, setQuery] = useState('');
  const [editor, setEditor] = useState<{ user: ManagedUser | null } | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setUsers((await api<{ users: ManagedUser[] }>('/api/users')).users); }
    catch (err) { setError(err instanceof Error ? err.message : 'Pengguna belum dapat dimuat.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = users.filter((user) => `${user.name} ${user.email} ${roleLabels[user.role]}`.toLowerCase().includes(query.toLowerCase()));
  return <><PageHeader eyebrow="Administrasi" title="Pengguna" description="Kelola akun dan hak akses tim Anda." actions={<button className="primary" onClick={() => { setEditor({ user: null }); setFeedback(''); }}><Add size={18} aria-hidden="true" /> Tambah Pengguna</button>} />
    {feedback && <Feedback>{feedback}</Feedback>}
    {editor && <UserEditor key={editor.user?.id ?? 'new'} user={editor.user} onCancel={() => setEditor(null)} onSaved={async (saved) => { setEditor(null); setFeedback('Data pengguna berhasil disimpan.'); await load(); if (saved.id === currentUser.id) await refreshSession(); }} />}
    {loading ? <LoadingPanel /> : error ? <div className="state-panel"><Feedback error>{error}</Feedback><button onClick={() => void load()}>Coba Lagi</button></div> : <>
      <div className="stats-row"><MetricTile label="Seluruh pengguna" value={users.length} emphasis /><MetricTile label="Akun aktif" value={users.filter((u) => u.isActive).length} /><MetricTile label="Akun nonaktif" value={users.filter((u) => !u.isActive).length} /></div>
      <section className="table-card" aria-label="Daftar pengguna"><div className="table-toolbar"><h2>Daftar pengguna</h2><input aria-label="Cari pengguna" type="search" placeholder="Cari nama, email, atau peran…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        {!filtered.length ? <div className="state-panel">{users.length ? 'Tidak ada pengguna yang cocok dengan pencarian.' : 'Belum ada pengguna. Tambahkan akun untuk tim Anda.'}</div> : <div className="table-scroll"><table><thead><tr><th>Pengguna</th><th>Peran</th><th>Status</th><th><span className="sr-only">Tindakan</span></th></tr></thead><tbody>{filtered.map((user) => <tr key={user.id}><td data-label="Pengguna"><div className="person-cell"><span className="avatar" aria-hidden="true">{user.name.slice(0, 1).toUpperCase()}</span><div><strong>{user.name}{user.id === currentUser.id && <small className="you-label"> Anda</small>}</strong><span>{user.email}</span></div></div></td><td data-label="Peran"><StatusTag tone="info">{roleLabels[user.role]}</StatusTag></td><td data-label="Status"><StatusTag tone={user.isActive ? 'success' : 'neutral'}>{user.isActive ? 'Aktif' : 'Nonaktif'}</StatusTag></td><td data-label="Tindakan"><button aria-label={`Ubah ${user.name}`} onClick={() => { setEditor({ user }); setFeedback(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}><Edit size={16} aria-hidden="true" /> Ubah</button></td></tr>)}</tbody></table></div>}
      </section><p className="muted small">Perubahan peran, status akun, atau kata sandi akan mengakhiri seluruh sesi pengguna terkait.</p></>}
  </>;
}
