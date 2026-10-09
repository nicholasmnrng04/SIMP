import { useEffect, useState } from 'react';
import type { ActivityPage } from '../../../shared/activity';
import type { Project } from '../../../shared/projects';
import { api } from '../api';
import { EmptyState, Feedback, LoadingPanel, PageHeader } from '../components/ui';

const actions = [
  ['CREATE_PROJECT', 'Proyek dibuat'], ['UPDATE_PROJECT', 'Proyek diperbarui'],
  ['CREATE_USER', 'Pengguna dibuat'], ['UPDATE_USER', 'Pengguna diperbarui'],
  ['PUBLISH_PLAN', 'Rencana diterbitkan'], ['SUBMIT_REPORT', 'Laporan dikirim'],
  ['APPROVE', 'Laporan disetujui'], ['REQUEST_CHANGES', 'Perbaikan diminta'],
  ['CHANGE_OWN_PASSWORD', 'Kata sandi diubah'],
];

export function Activity() {
  const params = new URLSearchParams(window.location.search);
  const [data, setData] = useState<ActivityPage | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    Promise.all([
      api<ActivityPage>(`/api/activity${window.location.search}`),
      api<{ projects: Project[] }>('/api/projects?archived=true'),
    ]).then(([page, list]) => { if (active) { setData(page); setProjects(list.projects); } })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Aktivitas belum dapat dimuat.'); });
    return () => { active = false; };
  }, []);
  const pageUrl = (page: number) => { const next = new URLSearchParams(params); next.set('page', String(page)); return `/aktivitas?${next}`; };
  const filter = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget), next = new URLSearchParams();
    for (const key of ['projectId', 'action', 'from', 'to']) {
      const value = String(values.get(key) ?? '').trim();
      if (value) next.set(key, value);
    }
    window.location.assign(`/aktivitas${next.size ? `?${next}` : ''}`);
  };
  return <div className="activity-page">
    <PageHeader eyebrow="Pengawasan" title="Aktivitas" description="Jejak perubahan akun, proyek, rencana, dan laporan yang boleh Anda lihat." />
    <section className="activity-filter-panel" aria-labelledby="activity-filter-title"><h2 id="activity-filter-title">Saring aktivitas</h2>
      <form className="activity-filters" onSubmit={filter}>
        <label>Proyek<select name="projectId" defaultValue={params.get('projectId') ?? ''}><option value="">Semua proyek</option>{projects.map(project => <option key={project.id} value={project.id}>{project.projectName}</option>)}</select></label>
        <label>Jenis aktivitas<select name="action" defaultValue={params.get('action') ?? ''}><option value="">Semua jenis</option>{actions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Dari tanggal<input name="from" type="date" defaultValue={params.get('from') ?? ''} /></label>
        <label>Sampai tanggal<input name="to" type="date" defaultValue={params.get('to') ?? ''} /></label>
        <div className="activity-filter-actions"><button type="submit">Terapkan</button><a className="button secondary" href="/aktivitas">Hapus filter</a></div>
      </form>
    </section>
    {error && <Feedback error>{error}</Feedback>}
    {!error && !data && <LoadingPanel text="Memuat aktivitas…" />}
    {data && <section className="activity-list-panel" aria-labelledby="activity-list-title"><div className="activity-list-heading"><h2 id="activity-list-title">Riwayat aktivitas</h2><span>{data.total.toLocaleString('id-ID')} kejadian</span></div>
      {data.entries.length === 0 ? <EmptyState title="Belum ada aktivitas"><p>Ubah filter atau mulai bekerja pada proyek untuk melihat jejak aktivitas.</p></EmptyState> : <div className="activity-table-wrap" role="region" aria-label="Tabel aktivitas" tabIndex={0}><table className="activity-table"><thead><tr><th scope="col">Waktu</th><th scope="col">Aktivitas</th><th scope="col">Pelaku</th><th scope="col">Proyek</th><th scope="col">Tautan</th></tr></thead><tbody>{data.entries.map(entry => <tr key={entry.id}>
        <td data-label="Waktu"><time dateTime={entry.date}>{new Date(entry.date).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</time></td>
        <td data-label="Aktivitas"><strong>{entry.action}</strong></td><td data-label="Pelaku">{entry.actor}</td>
        <td data-label="Proyek">{entry.projectName ?? 'Akun / sistem'}</td><td data-label="Tautan">{entry.url ? <a href={entry.url}>Buka</a> : '—'}</td>
      </tr>)}</tbody></table></div>}
      {data.total > data.pageSize && <nav className="activity-pagination" aria-label="Halaman aktivitas">
        {data.page > 1 && <a className="button secondary" href={pageUrl(data.page - 1)}>Sebelumnya</a>}
        <span>Halaman {data.page} dari {Math.ceil(data.total / data.pageSize)}</span>
        {data.page * data.pageSize < data.total && <a className="button secondary" href={pageUrl(data.page + 1)}>Berikutnya</a>}
      </nav>}
    </section>}
  </div>;
}
