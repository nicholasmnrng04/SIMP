import { useState } from 'react';
import { loginSchema } from '../../../shared/validation';
import type { SessionUser } from '../../../shared/contracts';
import { api, ApiError } from '../api';
import { Brand, Feedback, Field } from '../components/ui';

export function Login({ notice }: { notice?: string }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(''), [errors, setErrors] = useState<Record<string, string>>({});
  function validate(field?: string) {
    const result = loginSchema.safeParse({ email, password });
    const next: Record<string, string> = {};
    if (!result.success) for (const issue of result.error.issues) next[String(issue.path[0])] ??= issue.message;
    setErrors((previous) => field ? { ...previous, [field]: next[field] ?? '' } : next);
    return result.success;
  }
  return <div className="login-page"><header className="login-header"><Brand href="/" /><a href="/">Kembali ke halaman awal</a></header>
    <main className="login-main"><section className="login-story"><p className="eyebrow">SELAMAT DATANG KEMBALI</p>
      <h1>Terhubung dengan tim.<br /><span>Dekat dengan perkembangan.</span></h1>
      <p className="intro">Masuk untuk mengakses ruang kerja dan informasi sesuai tanggung jawab Anda dalam proyek.</p>
      <div className="login-note"><span aria-hidden="true">◎</span><p>Satu akun untuk bekerja bersama.<br /><strong>Informasi sesuai hak akses Anda.</strong></p></div>
    </section><section className="login-card" aria-labelledby="login-title"><p className="eyebrow">AKUN SIMP</p><h2 id="login-title">Masuk ke aplikasi</h2><p>Gunakan akun yang diberikan Administrator.</p>
      {notice && <Feedback>{notice}</Feedback>}{message && <Feedback error>{message}</Feedback>}
      <form noValidate onSubmit={async (event) => {
        event.preventDefault(); if (busy || !validate()) return;
        setBusy(true); setMessage('');
        try {
          const { user } = await api<{ user: SessionUser }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
          window.location.assign('/ringkasan');
        } catch (error) {
          setMessage(error instanceof Error ? error.message : 'Belum dapat masuk.');
          if (error instanceof ApiError) setErrors(error.fields);
          setBusy(false);
        }
      }}>
        <Field id="email" label="Email" error={errors.email}><input id="email" type="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setErrors((previous) => ({ ...previous, email: '' })); }} onBlur={() => validate('email')} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-error' : undefined} disabled={busy} placeholder="nama@perusahaan.co.id" /></Field>
        <Field id="password" label="Kata sandi" error={errors.password}><div className="password-control"><input id="password" type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((previous) => ({ ...previous, password: '' })); }} onBlur={() => validate('password')} aria-invalid={!!errors.password} aria-describedby={errors.password ? 'password-error' : undefined} disabled={busy} /><button type="button" onClick={() => setVisible(!visible)} aria-pressed={visible}>{visible ? 'Sembunyikan' : 'Lihat'}</button></div></Field>
        <button className="primary full-width" disabled={busy} type="submit">{busy ? 'Memeriksa akun…' : 'Masuk'} <span aria-hidden="true">→</span></button>
      </form><p className="login-help">Belum memiliki akun atau lupa kata sandi?<br />Hubungi Administrator Anda.</p>
    </section></main><footer>SIMP · Sistem Informasi Monitoring Proyek</footer></div>;
}
