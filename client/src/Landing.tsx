import { useCallback, useEffect, useState } from 'react';
import type { HealthResponse } from '../../shared/contracts';
import { Brand } from './components/ui';

export function Landing() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const checkConnection = useCallback(async (signal?: AbortSignal) => {
    setStatus('loading');
    try {
      const response = await fetch('/api/health', { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json() as HealthResponse;
      if (data.status !== 'ok') throw new Error('unavailable');
      if (!signal?.aborted) setStatus('ready');
    } catch {
      if (!signal?.aborted) setStatus('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void checkConnection(controller.signal);
    return () => controller.abort();
  }, [checkConnection]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <Brand href="/" />
        <div className="top-actions"><a className="button primary" href="/masuk">Masuk <span aria-hidden="true">→</span></a></div>
      </header>
      <main>
        <section className="welcome" aria-labelledby="welcome-title">
          <p className="eyebrow">Sistem Informasi Monitoring Proyek</p>
          <h1 id="welcome-title">Setiap pekerjaan.<br /><span>Terpantau dengan jelas.</span></h1>
          <p className="intro">Satu tempat untuk rencana pekerjaan, catatan kegiatan lapangan, dan perkembangan proyek Anda.</p>
          <div className="connection-card service-status">
            <div className={`status-indicator ${status}`} aria-hidden="true" />
            <div className="connection-copy" role="status" aria-live="polite">
              <strong>{status === 'loading' ? 'Memeriksa koneksi…' : status === 'ready' ? 'Layanan terhubung' : 'Koneksi belum tersedia'}</strong>
              <p>{status === 'loading' ? 'Mohon tunggu sebentar.' : status === 'ready' ? 'SIMP siap digunakan.' : 'Silakan coba kembali.'}</p>
            </div>
            <button type="button" disabled={status === 'loading'} onClick={() => void checkConnection()}><span aria-hidden="true">↻</span> {status === 'error' ? 'Coba Lagi' : 'Periksa Koneksi'}</button>
          </div>
        </section>
        <aside className="overview" aria-label="Alur monitoring proyek">
          <span className="overview-caption">DARI RENCANA KE HASIL</span>
          <ol>
            <li><span className="step-number">01</span><div><h2>Rencanakan pekerjaan</h2><p>Susun pekerjaan dan target pelaksanaan proyek.</p></div></li>
            <li><span className="step-number">02</span><div><h2>Catat kegiatan lapangan</h2><p>Simpan kegiatan, kondisi lapangan, dan dokumentasi.</p></div></li>
            <li><span className="step-number">03</span><div><h2>Pantau perkembangannya</h2><p>Lihat hasil pemeriksaan dan capaian pekerjaan.</p></div></li>
          </ol>
          <p className="overview-footnote">Informasi yang saling terhubung untuk tim proyek Anda.</p>
        </aside>
      </main>
      <footer>SIMP <span aria-hidden="true">·</span> Sistem Informasi Monitoring Proyek</footer>
    </div>
  );
}
