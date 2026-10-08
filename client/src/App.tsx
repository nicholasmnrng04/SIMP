import { useCallback, useEffect, useState } from 'react';
import Close from '@carbon/icons-react/es/Close.js';
import Home from '@carbon/icons-react/es/Home.js';
import Logout from '@carbon/icons-react/es/Logout.js';
import Menu from '@carbon/icons-react/es/Menu.js';
import Portfolio from '@carbon/icons-react/es/Portfolio.js';
import UserMultiple from '@carbon/icons-react/es/UserMultiple.js';
import type { SessionUser } from '../../shared/contracts';
import { roleLabels } from '../../shared/contracts';
import { api, ApiError } from './api';
import { Brand, Feedback, LoadingPanel, PageHeader } from './components/ui';
import { Landing } from './Landing';
import { Login } from './pages/Login';
import { Users } from './pages/Users';
import { Projects } from './pages/Projects';
import { DashboardPage } from './pages/Monitoring';
import { ProjectSidebar } from './components/ProjectSidebar';
import './projects.css';
import './workspace.css';

export function App() {
  const path = window.location.pathname;
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(path !== '/'), [error, setError] = useState('');
  const [notice, setNotice] = useState(''), [logoutBusy, setLogoutBusy] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const refresh = useCallback(async () => {
    try { setUser((await api<{ user: SessionUser }>('/api/auth/me')).user); setError(''); }
    catch (err) {
      if (err instanceof ApiError && err.status === 401) { setUser(null); setError(''); }
      else setError(err instanceof Error ? err.message : 'Sesi belum dapat diperiksa.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    if (path === '/') return;
    void refresh();
    const ended = () => { setUser(null); setNotice('Sesi Anda berakhir. Silakan masuk kembali.'); };
    const focused = () => { void refresh(); };
    window.addEventListener('simp:session-ended', ended);
    window.addEventListener('focus', focused);
    return () => { window.removeEventListener('simp:session-ended', ended); window.removeEventListener('focus', focused); };
  }, [path, refresh]);
  useEffect(() => {
    if (!loading && !error && user && path === '/masuk') window.location.replace('/ringkasan');
  }, [user, path, loading, error]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const sidebar = document.querySelector<HTMLElement>('.sidebar');
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () => Array.from(sidebar?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), select:not(:disabled)') ?? []).filter(el => el.getClientRects().length > 0);
    focusables()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileMenuOpen(false); }
      if (event.key !== 'Tab') return;
      const elements = focusables(), first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const viewport = window.matchMedia('(max-width: 720px)');
    const resize = () => { if (!viewport.matches) setMobileMenuOpen(false); };
    document.addEventListener('keydown', keydown);
    viewport.addEventListener('change', resize);
    return () => { document.removeEventListener('keydown', keydown); viewport.removeEventListener('change', resize); document.body.style.overflow = previousOverflow; opener?.focus(); };
  }, [mobileMenuOpen]);

  if (path === '/') return <Landing />;
  if (loading) return <div className="auth-state"><LoadingPanel text="Memeriksa sesi Anda…" /></div>;
  if (error && !user) return <div className="auth-state"><Feedback error>{error}</Feedback><button onClick={() => { setLoading(true); void refresh(); }}>Coba Lagi</button></div>;
  if (!user) return <Login notice={notice} />;
  return <div className="workspace">
    {mobileMenuOpen && <button className="mobile-nav-backdrop" aria-label="Tutup navigasi" onClick={() => setMobileMenuOpen(false)} />}
    <aside className={`sidebar${mobileMenuOpen ? ' mobile-open' : ''}`}><button type="button" className="sidebar-close" onClick={() => setMobileMenuOpen(false)}>Tutup menu <Close size={20} aria-hidden="true" /></button><Brand /><p className="nav-label">RUANG KERJA</p><nav aria-label="Navigasi utama">
      <a className={path === '/ringkasan' ? 'selected' : ''} href="/ringkasan" aria-current={path === '/ringkasan' ? 'page' : undefined}><Home size={20} aria-hidden="true" /> Beranda</a>
      <a className={path.startsWith('/proyek') ? 'selected' : ''} href="/proyek" aria-current={path.startsWith('/proyek') ? 'page' : undefined}><Portfolio size={20} aria-hidden="true" /> Proyek</a>
      {user.role === 'ADMINISTRATOR' && <a className={path === '/pengguna' ? 'selected' : ''} href="/pengguna" aria-current={path === '/pengguna' ? 'page' : undefined}><UserMultiple size={20} aria-hidden="true" /> Pengguna</a>}
    </nav><ProjectSidebar path={path} onNavigate={() => setMobileMenuOpen(false)} /><div className="sidebar-foot"><span className="prototype-label">Prototipe</span><p>Sistem Informasi<br />Monitoring Proyek</p></div></aside>
    <div className="workspace-body"><header className="workspace-header"><button className="mobile-menu-button" type="button" aria-label={mobileMenuOpen ? 'Tutup navigasi' : 'Buka navigasi'} aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>{mobileMenuOpen ? <Close size={20} /> : <Menu size={20} />}<span>Menu</span></button><span>Ruang kerja · {roleLabels[user.role]}</span><div className="account-menu"><div><strong>{user.name}</strong><small>{roleLabels[user.role]}</small></div><button disabled={logoutBusy} onClick={async () => {
      setLogoutBusy(true); setError('');
      try { await api('/api/auth/logout', { method: 'POST' }); setUser(null); setNotice('Anda berhasil keluar.'); window.history.replaceState(null, '', '/masuk'); }
      catch (err) { setError(err instanceof Error ? err.message : 'Belum dapat keluar. Silakan coba kembali.'); }
      finally { setLogoutBusy(false); }
    }}>{logoutBusy ? 'Keluar…' : 'Keluar'} <Logout size={18} aria-hidden="true" /></button></div></header>
    <main className="workspace-main">
      {error && <Feedback error>{error}</Feedback>}
      {path.startsWith('/proyek') ? <Projects user={user} /> : path === '/pengguna' ? user.role === 'ADMINISTRATOR' ? <Users currentUser={user} refreshSession={refresh} /> : <section className="state-panel"><h1>Akses tidak tersedia</h1><p>Halaman ini hanya dapat dibuka oleh Administrator.</p><a href="/ringkasan" className="button">Kembali ke Ringkasan</a></section> :
      <><PageHeader eyebrow="Beranda" title="Proyek Anda" description={user.role === 'TEAM_LEADER' ? <>Pantau kemajuan dan selesaikan pekerjaan yang perlu ditindaklanjuti.</> : <>Selamat datang, {user.name}. Pilih proyek untuk mulai bekerja.</>} actions={user.role === 'ADMINISTRATOR' ? <a className="button" href="/pengguna">Kelola Pengguna</a> : undefined} /><DashboardPage user={user}/></>}
    </main></div>
  </div>;
}
