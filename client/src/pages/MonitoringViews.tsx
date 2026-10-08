import { useEffect, useState } from 'react';
import type { SessionUser } from '../../../shared/contracts';
import type { Curve, Dashboard, Monitoring, Gallery, HistoryEntry } from '../../../shared/monitoring';
import { displayDecimal } from '../../../shared/work-items';
import { projectStatusLabels } from '../../../shared/projects';
import { reportStatuses } from '../../../shared/reports';
import { api } from '../api';
import { EmptyState, Feedback, Field, LoadingPanel, MetricTile, PageHeader, StatusTag } from '../components/ui';
import { WorkProgressTable } from '../components/WorkProgressTable';
import { Chart, History } from './Monitoring';
import { useQueryState, queryString } from '../query-state';

const number = (v: string | null) => v === null ? '—' : `${v.startsWith('-') ? '-' : ''}${displayDecimal(v.replace(/^-/, ''), 2)}`;
const percent = (value: string | null | undefined) => value == null ? '—' : `${number(value)}%`;
const dateLabel = (value: string) => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));

export function GalleryPanel({ projectId, initialWork = '' }: { projectId: string; initialWork?: string }) {
  const filter = useQueryState({ from:'', to:'', workItemId:initialWork, reportId:'', uploadedBy:'' });
  const [data, setData] = useState<Gallery | null>(null), [options, setOptions] = useState<Gallery['photos']>([]);
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    api<Gallery>(`/api/projects/${projectId}/gallery?${queryString(filter.applied)}`).then(result => { if (active) setData(result); })
      .catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, filter.applied, retry]);
  useEffect(() => { let active = true; api<Gallery>(`/api/projects/${projectId}/gallery`).then(result => { if (active) setOptions(result.photos); }).catch(() => {}); return () => { active = false; }; }, [projectId, retry]);
  const unique = (key: 'workItemId' | 'reportId' | 'uploadedBy') => [...new Map(options.filter(p => p[key]).map(p => [p[key], p])).values()];
  const field = (key: keyof typeof filter.values, value: string) => filter.setValues({ ...filter.values, [key]: value });
  return <><PageHeader eyebrow="DOKUMENTASI PROYEK" title="Dokumentasi" description="Foto kegiatan dari laporan yang dapat Anda akses." />
    <section className="info-panel"><h2>Filter foto</h2><form className="form-grid" onSubmit={e => { e.preventDefault(); filter.apply(); }}>
      <Field id="photo-from" label="Foto dari tanggal"><input id="photo-from" type="date" value={filter.values.from} onChange={e => field('from', e.target.value)} /></Field>
      <Field id="photo-to" label="Foto sampai tanggal"><input id="photo-to" type="date" value={filter.values.to} onChange={e => field('to', e.target.value)} /></Field>
      <Field id="photo-work" label="Pekerjaan foto"><select id="photo-work" value={filter.values.workItemId} onChange={e => field('workItemId', e.target.value)}><option value="">Semua pekerjaan</option>{initialWork && !unique('workItemId').some(p => p.workItemId === initialWork) && <option value={initialWork}>Pekerjaan yang dipilih</option>}{unique('workItemId').map(p => <option key={p.workItemId} value={p.workItemId!}>{p.workName}</option>)}</select></Field>
      <Field id="photo-report" label="Laporan sumber foto"><select id="photo-report" value={filter.values.reportId} onChange={e => field('reportId', e.target.value)}><option value="">Semua laporan</option>{unique('reportId').map(p => <option key={p.reportId} value={p.reportId}>{p.reportNumber} · versi {p.revision}</option>)}</select></Field>
      <Field id="photo-uploader" label="Pengunggah foto"><select id="photo-uploader" value={filter.values.uploadedBy} onChange={e => field('uploadedBy', e.target.value)}><option value="">Semua pengunggah</option>{unique('uploadedBy').map(p => <option key={p.uploadedBy} value={p.uploadedBy}>{p.uploader}</option>)}</select></Field>
      <div className="form-actions"><button className="primary" disabled={loading}>Saring Foto</button><button type="button" onClick={() => filter.apply({from:'',to:'',workItemId:'',reportId:'',uploadedBy:''})}>Bersihkan Filter</button></div>
    </form></section>
    {loading ? <LoadingPanel /> : error ? <><Feedback error>{error}</Feedback><button onClick={() => setRetry(retry + 1)}>Coba Lagi</button></> : <>
      {!data?.photos.length && <EmptyState title="Belum ada foto"><p>Belum ada foto yang sesuai atau dapat diakses.</p></EmptyState>}
      <div className="monitor-gallery">{data?.photos.map(p => <figure key={p.id}><a href={`/proyek/${projectId}/laporan/${p.reportId}`}><img src={p.url} alt={p.caption} loading="lazy" /></a><figcaption><strong>{p.caption}</strong><p>{p.date} · {p.location}</p><p>{p.activity}</p><details><summary>Informasi foto</summary><p>{p.uploader} · {p.reportNumber} versi {p.revision} · {reportStatuses[p.status as keyof typeof reportStatuses]}</p></details></figcaption></figure>)}</div>
    </>}
  </>;
}

export function ProjectHistory({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; setError(''); api<{ entries: HistoryEntry[] }>(`/api/projects/${projectId}/history`).then(data => { if (active) setEntries(data.entries); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [projectId, retry]);
  return <><a className="back-link" href={`/proyek/${projectId}`}>Kembali ke Ringkasan</a><PageHeader eyebrow="AKTIVITAS PROYEK" title="Riwayat proyek" description="Perubahan penting dan tindakan yang tercatat pada proyek ini." />{error ? <><Feedback error>{error}</Feedback><button onClick={() => setRetry(retry + 1)}>Coba Lagi</button></> : entries ? <History entries={entries} /> : <LoadingPanel />}</>;
}

export function ProjectMonitoring({ projectId, user }: { projectId: string; user: SessionUser }) {
  const filter = useQueryState({cutoff:'',type:'WEEKLY',planVersionId:''});
  const presentation = useQueryState({display:'table'});
  const [data,setData] = useState<Monitoring | null>(null), [error,setError] = useState(''), [loading,setLoading] = useState(true), [retry,setRetry] = useState(0);
  useEffect(() => { let active = true; setLoading(true); setError(''); api<Monitoring>(`/api/projects/${projectId}/monitoring?${queryString(filter.applied)}`).then(m => { if (active) setData(m); }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [projectId,filter.applied,retry]);
  useEffect(() => {
    if (loading || !data || window.location.hash !== '#masalah-lapangan') return;
    const frame = window.requestAnimationFrame(() => document.getElementById('masalah-lapangan')?.scrollIntoView());
    return () => window.cancelAnimationFrame(frame);
  }, [loading, data]);
  const root = `/proyek/${projectId}`;
  if (loading) return <LoadingPanel />;
  if (error || !data) return <><Feedback error>{error || 'Ringkasan belum tersedia.'}</Feedback><button onClick={() => setRetry(retry + 1)}>Coba Lagi</button></>;
  const p = data.progress, own = user.role === 'INSPECTOR';
  const pending = data.reports.filter(r => own ? ['DRAFT','NEEDS_REVISION'].includes(r.status) : r.status === 'SUBMITTED');
  const task = user.role === 'OWNER' ? ['Baca laporan proyek',`${root}/laporan`] : user.role === 'ADMINISTRATOR' ? ['Kelola tim proyek',`${root}/tim`] : user.role === 'TEAM_LEADER' && !p.plans.length ? ['Susun rencana pekerjaan',`${root}/rencana`] : own ? ['Buka laporan saya',`${root}/laporan`] : [user.role === 'ENGINEER' ? 'Periksa laporan dan beri catatan' : 'Periksa laporan',`${root}/laporan`];
  return <><PageHeader eyebrow="KONDISI PROYEK" title="Ringkasan proyek" description={`Kemajuan sampai ${p.cutoff} · akhir jadwal ${data.scheduleEnd}`} actions={<a className="button" href={`${root}/riwayat`}>Riwayat proyek</a>} />
    {p.state !== 'READY' && <Feedback>{p.state === 'NO_BASELINE' ? 'Rencana Awal belum ditetapkan. Angka kemajuan belum dapat dihitung.' : 'Belum ada rencana yang berlaku pada tanggal ini.'}</Feedback>}
    {p.warning && <Feedback>{p.warning}</Feedback>}
    <div className="monitor-cards">{[['Capaian',`${number(p.total.actual.cumulative)}%`],['Target',`${number(p.total.target.cumulative)}%`],['Selisih terhadap target',`${number(p.total.deviation)} poin persentase`],['Sisa hari',data.remainingDays]].map(([label,value],index) => <MetricTile key={label} label={label} value={value} emphasis={index===0} />)}</div>
    <section className="next-action"><h2>{own ? 'Laporan yang perlu diselesaikan' : user.role === 'OWNER' ? 'Pantau hasil pekerjaan' : 'Langkah berikutnya'}</h2>
      {!!pending.length && user.role !== 'OWNER' && <p>{pending.length} laporan {own ? 'belum selesai atau perlu diperbaiki' : 'menunggu pemeriksaan'}.</p>}
      <a className="button primary" href={task[1]}>{task[0]}</a>
      {pending.slice(0,3).map(r => <p key={r.id}><a href={`${root}/laporan/${r.id}`}>{r.number}</a> · {r.date} · {reportStatuses[r.status as keyof typeof reportStatuses]}</p>)}
    </section>
    <div className="inline-actions"><a className="button" href={`${root}/progress?${queryString({from:'',cutoff:p.cutoff,planVersionId:filter.applied.planVersionId})}`}>Rincian kemajuan</a><a className="button" href={`${root}/laporan-berkala`}>Baca rekap laporan</a></div>
    <section className="info-panel"><h2>Tanggal dan pembanding grafik</h2><form className="form-grid" onSubmit={e => { e.preventDefault(); filter.apply(); }}>
      <Field id="monitor-cutoff" label="Sampai tanggal"><input id="monitor-cutoff" type="date" max={p.today} value={filter.values.cutoff || p.cutoff} onChange={e => filter.setValues({...filter.values,cutoff:e.target.value})} /></Field>
      <Field id="monitor-type" label="Periode grafik"><select id="monitor-type" value={filter.values.type} onChange={e => filter.setValues({...filter.values,type:e.target.value})}><option value="WEEKLY">Mingguan</option><option value="MONTHLY">Bulanan</option></select></Field>
      <Field id="monitor-plan" label="Pembanding grafik"><select id="monitor-plan" value={filter.values.planVersionId} onChange={e => filter.setValues({...filter.values,planVersionId:e.target.value})}><option value="">Rencana terbaru yang ditetapkan</option>{p.plans.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></Field><button>Tampilkan Ringkasan</button>
    </form></section>
    <section className="info-panel" id="masalah-lapangan"><h2>Masalah lapangan</h2>{!data.problems.length && <p>Tidak ada masalah terbuka yang dapat diakses.</p>}{data.problems.map((v,i) => <p key={i}><a href={`${root}/laporan/${v.reportId}`}>{v.problem}</a> · {v.date} · {v.status}</p>)}</section>
    <section className="monitor-view info-panel"><div className="view-choice" role="group" aria-label="Tampilan kemajuan"><button type="button" aria-pressed={presentation.applied.display !== 'curve'} onClick={() => presentation.apply({display:'table'})}>Tabel pekerjaan</button><button type="button" aria-pressed={presentation.applied.display === 'curve'} onClick={() => presentation.apply({display:'curve'})}>Grafik rencana dan capaian</button></div>{presentation.applied.display === 'curve' ? <section aria-label="Kurva-S proyek"><div className="section-heading"><h2>Kurva-S</h2><a className="button" href={`${root}/ekspor?kind=CURVE&cutoff=${p.cutoff}&planVersionId=${filter.applied.planVersionId}`}>Unduh grafik</a></div><Chart curve={data.curve} /></section> : <WorkProgressTable items={p.items} />}</section>
    <section className="info-panel"><h2>Pekerjaan sedang berjalan</h2>{p.items.filter(i => data.ongoing.includes(i.id)).map(i => <p key={i.id}>{i.code} — {i.name}: {number(i.actual.cumulative.physical)}%</p>)}{!data.ongoing.length && <p>Belum ada pekerjaan sedang berjalan.</p>}</section>
    {user.role === 'ENGINEER' && <section className="info-panel"><h2>Catatan teknis</h2>{!data.notes.length && <p>Belum ada catatan teknis.</p>}{data.notes.map((v,i) => <p key={i}><a href={`${root}/laporan/${v.reportId}`}>{v.note}</a> · {v.actor}</p>)}</section>}
    <p className="muted small">Hari ke-{data.day}. Target mengikuti rencana yang berlaku pada {p.cutoff}. Antrean dan masalah menunjukkan keadaan terkini.</p>
  </>;
}

export function DashboardPage({ user }: { user: SessionUser }) {
  const [data,setData] = useState<Dashboard | null>(null), [error,setError] = useState(''), [retry,setRetry] = useState(0);
  const projectFilter = useQueryState({project:''});
  const [monitoring,setMonitoring] = useState<Monitoring | null>(null), [monitorError,setMonitorError] = useState(''), [monitorLoading,setMonitorLoading] = useState(false);
  const [monitoringProjectId,setMonitoringProjectId] = useState('');
  const [gallery,setGallery] = useState<Gallery | null>(null), [galleryError,setGalleryError] = useState(''), [galleryLoading,setGalleryLoading] = useState(false), [galleryRetry,setGalleryRetry] = useState(0);
  const [galleryProjectId,setGalleryProjectId] = useState('');
  const [portfolioQuery,setPortfolioQuery] = useState('');
  useEffect(() => { let active = true; setError(''); api<Dashboard>('/api/dashboard').then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [retry]);
  const selectedProjectId = data?.projects.some(project => project.id === projectFilter.applied.project) ? projectFilter.applied.project : data?.projects[0]?.id ?? '';
  useEffect(() => {
    if (user.role !== 'TEAM_LEADER' || !selectedProjectId) { setMonitoring(null); setMonitoringProjectId(''); return; }
    let active = true; setMonitoring(null); setMonitoringProjectId(''); setMonitorLoading(true); setMonitorError('');
    api<Monitoring>(`/api/projects/${selectedProjectId}/monitoring`).then(result => { if (active) { setMonitoring(result); setMonitoringProjectId(selectedProjectId); } })
      .catch(e => { if (active) setMonitorError(e instanceof Error ? e.message : 'Pemantauan proyek belum dapat dimuat.'); })
      .finally(() => { if (active) setMonitorLoading(false); });
    return () => { active = false; };
  }, [selectedProjectId, user.role, retry]);
  useEffect(() => {
    if (user.role !== 'TEAM_LEADER' || !selectedProjectId) { setGallery(null); setGalleryProjectId(''); return; }
    let active = true; setGallery(null); setGalleryProjectId(''); setGalleryLoading(true); setGalleryError('');
    api<Gallery>(`/api/projects/${selectedProjectId}/gallery`).then(result => { if (active) { setGallery(result); setGalleryProjectId(selectedProjectId); } })
      .catch(e => { if (active) setGalleryError(e instanceof Error ? e.message : 'Dokumentasi belum dapat dimuat.'); })
      .finally(() => { if (active) setGalleryLoading(false); });
    return () => { active = false; };
  }, [selectedProjectId, user.role, galleryRetry]);
  if (error) return <><Feedback error>{error}</Feedback><button onClick={() => setRetry(retry + 1)}>Coba Lagi</button></>;
  if (!data) return <LoadingPanel />;
  if (user.role === 'TEAM_LEADER') {
    const currentMonitoring = monitoringProjectId === selectedProjectId ? monitoring : null;
    const currentGallery = galleryProjectId === selectedProjectId ? gallery : null;
    const selectedProject = data.projects.find(project => project.id === selectedProjectId);
    const selectedSummary = data.projectSummaries.find(summary => summary.projectId === selectedProjectId);
    const summaries = data.projects.map(project => ({ project, summary: data.projectSummaries.find(item => item.projectId === project.id) })).sort((a,b) => {
      const score = (row: typeof a) => (row.project.status === 'DELAYED' ? 1000 : 0) + (row.summary?.pendingReviews ?? 0) * 100 + (row.summary?.openProblems ?? 0) * 10 + (row.summary?.needsRevision ?? 0);
      return score(b) - score(a);
    });
    const firstPending = currentMonitoring?.reports.find(report => report.status === 'SUBMITTED');
    const actionRows = selectedSummary ? [
      { label: 'Laporan menunggu pemeriksaan', count: selectedSummary.pendingReviews, detail: firstPending ? `Terbaru: ${firstPending.number} · ${dateLabel(firstPending.date)}` : 'Buka antrean laporan yang diajukan.', href: `/proyek/${selectedProjectId}/laporan?view=waiting`, action: 'Periksa laporan' },
      { label: 'Masalah lapangan terbuka', count: selectedSummary.openProblems, detail: currentMonitoring?.problems[0]?.problem ?? 'Baca masalah yang dicatat di laporan.', href: `/proyek/${selectedProjectId}#masalah-lapangan`, action: 'Lihat masalah' },
      { label: 'Laporan dalam perbaikan', count: selectedSummary.needsRevision, detail: 'Menunggu pelapor melengkapi laporan.', href: `/proyek/${selectedProjectId}/laporan?status=NEEDS_REVISION&view=all`, action: 'Lihat laporan' },
      { label: selectedSummary.progressState === 'READY' ? 'Proyek terlambat' : 'Rencana belum siap', count: selectedProject?.status === 'DELAYED' || selectedSummary.progressState !== 'READY' ? 1 : 0, detail: selectedSummary.progressState === 'READY' ? 'Bandingkan capaian dengan target proyek.' : 'Buka jadwal dan target pekerjaan.', href: selectedSummary.progressState === 'READY' ? `/proyek/${selectedProjectId}/progress` : `/proyek/${selectedProjectId}/rencana`, action: selectedSummary.progressState === 'READY' ? 'Lihat kemajuan' : 'Buka rencana' },
    ].filter(row => row.count > 0) : [];
    const search = portfolioQuery.trim().toLocaleLowerCase('id-ID');
    const visibleSummaries = search ? summaries.filter(({ project }) => `${project.projectName} ${project.projectCode}`.toLocaleLowerCase('id-ID').includes(search)) : summaries;
    return <div className="leader-dashboard">
      <section className="dashboard-project-control info-panel" aria-labelledby="dashboard-condition-title">
        <div className="dashboard-project-identity"><p className="eyebrow">Proyek yang dipantau</p><h2 id="dashboard-condition-title">{selectedProject ? <a href={`/proyek/${selectedProject.id}`}>{selectedProject.projectName}</a> : 'Pilih proyek'}</h2>
          {selectedProject && <p className="dashboard-project-meta"><span>{selectedProject.projectCode}</span>{selectedProject.location && <span>{selectedProject.location}</span>}</p>}
          <p className="muted">{selectedSummary ? `Data sampai ${dateLabel(selectedSummary.cutoff)}` : 'Pilih proyek untuk melihat kondisi terbaru.'}{currentMonitoring && ` · Hari ke-${currentMonitoring.day}, sisa ${currentMonitoring.remainingDays} hari`}</p>
        </div>
        <div className="dashboard-project-choices"><label className="dashboard-project-picker">Ganti proyek<select aria-label="Proyek yang dipantau" value={selectedProjectId} onChange={event => projectFilter.apply({project:event.target.value})}>{data.projects.map(project => <option key={project.id} value={project.id}>{project.projectName}</option>)}</select></label>
          {selectedProject && <div className="dashboard-project-links"><StatusTag tone={selectedProject.status === 'DELAYED' ? 'danger' : selectedProject.status === 'COMPLETED' ? 'success' : 'info'}>{projectStatusLabels[selectedProject.status]}</StatusTag><a href={`/proyek/${selectedProject.id}/informasi`}>Informasi proyek</a></div>}
        </div>
      </section>
      {!data.projects.length ? <EmptyState title="Belum ada proyek yang dapat dipantau"><p>Tambahkan proyek atau pastikan penugasan Team Leader masih aktif.</p></EmptyState> : <>
        <div className="monitor-cards dashboard-kpis">
          <MetricTile label="Kemajuan aktual" value={percent(selectedSummary?.actual)} emphasis helper="Dari laporan yang disetujui" />
          <MetricTile label="Target sampai hari ini" value={percent(selectedSummary?.target)} helper="Sesuai rencana yang berlaku" />
          <MetricTile label="Selisih terhadap target" value={selectedSummary?.deviation == null ? '—' : `${number(selectedSummary.deviation)} poin`} />
          <MetricTile label="Menunggu pemeriksaan" value={selectedSummary?.pendingReviews ?? 0} helper="Laporan yang perlu ditinjau" />
        </div>
        <section className="info-panel dashboard-actions" aria-labelledby="dashboard-actions-title"><div className="section-heading"><div><p className="eyebrow">Pusat tindakan</p><h2 id="dashboard-actions-title">Yang perlu ditindaklanjuti</h2></div><a href={`/proyek/${selectedProjectId}/laporan?view=waiting`}>Buka laporan</a></div>
          {actionRows.length ? <ul className="dashboard-action-list">{actionRows.map(row => <li key={row.label}><span className="dashboard-action-count" aria-label={`${row.count} ${row.label}`}>{row.count}</span><div><strong>{row.label}</strong><p className="muted">{row.detail}</p></div><a href={row.href}>{row.action}</a></li>)}</ul> : <p className="dashboard-action-empty">Belum ada laporan atau masalah yang memerlukan perhatian pada proyek ini.</p>}
        </section>
        <div className="dashboard-analytics">
          <div className="dashboard-graphs">
            {monitorError && <section className="info-panel"><Feedback error>{monitorError}</Feedback><button onClick={() => setRetry(retry + 1)}>Coba Lagi</button></section>}
            {monitorLoading ? <LoadingPanel text="Memuat grafik kemajuan…" /> : currentMonitoring && <div className="dashboard-charts">
              <section className="info-panel"><div className="section-heading"><div><p className="eyebrow">Kemajuan</p><h2>Kurva target dan aktual</h2></div><a className="text-link" href={`/proyek/${selectedProjectId}/progress`}>Buka rincian</a></div><Chart curve={currentMonitoring.curve} /></section>
              <section className="info-panel"><div className="section-heading"><div><p className="eyebrow">Per periode</p><h2>Capaian berkala</h2></div></div><PeriodBarChart curve={currentMonitoring.curve} /></section>
            </div>}
          </div>
          <section className="info-panel dashboard-photo-panel" aria-labelledby="dashboard-photo-title"><div className="section-heading"><div><p className="eyebrow">Bukti lapangan</p><h2 id="dashboard-photo-title">Dokumentasi terbaru</h2></div><a href={`/proyek/${selectedProjectId}/dokumentasi`}>Lihat galeri</a></div>
            {galleryLoading ? <LoadingPanel text="Memuat foto terbaru…" /> : galleryError ? <><Feedback error>{galleryError}</Feedback><button onClick={() => setGalleryRetry(galleryRetry + 1)}>Coba Lagi</button></> : currentGallery?.photos.length ? <ul className="dashboard-photo-list">{currentGallery.photos.slice(0,3).map(photo => <li key={photo.id}><a href={`/proyek/${selectedProjectId}/laporan/${photo.reportId}`}><img src={photo.url} alt={photo.caption || 'Foto kegiatan lapangan'} loading="lazy" /></a><div><a href={`/proyek/${selectedProjectId}/laporan/${photo.reportId}`}><strong>{photo.caption || photo.activity}</strong></a><p>{photo.reportNumber} · {dateLabel(photo.date)}</p><small>{reportStatuses[photo.status as keyof typeof reportStatuses] ?? photo.status}</small></div></li>)}</ul> : <p>Belum ada foto laporan yang dapat ditampilkan.</p>}
          </section>
        </div>
        <section className="info-panel dashboard-portfolio" aria-labelledby="dashboard-portfolio-title"><div className="section-heading"><div><p className="eyebrow">Semua proyek</p><h2 id="dashboard-portfolio-title">Pemantauan proyek</h2></div><div className="dashboard-portfolio-tools"><label>Cari proyek<input type="search" value={portfolioQuery} onChange={event => setPortfolioQuery(event.target.value)} placeholder="Nama atau kode proyek" /></label><a className="button" href="/proyek">Kelola proyek</a></div></div>
          <p className="muted small" role="status">{visibleSummaries.length} dari {summaries.length} proyek ditampilkan.</p>
          {visibleSummaries.length ? <div className="responsive-table"><table className="adaptive-table project-monitor-table"><thead><tr><th>Proyek</th><th>Status</th><th>Target</th><th>Aktual</th><th>Selisih</th><th>Menunggu</th><th>Masalah</th><th>Aktivitas terakhir</th><th>Tindakan</th></tr></thead><tbody>{visibleSummaries.map(({project,summary}) => <tr key={project.id} className={project.id === selectedProjectId ? 'dashboard-selected-project' : undefined}><td data-label="Proyek"><strong>{project.projectName}</strong><small>{project.projectCode}</small></td><td data-label="Status"><StatusTag tone={project.status === 'DELAYED' ? 'danger' : project.status === 'COMPLETED' ? 'success' : 'info'}>{projectStatusLabels[project.status]}</StatusTag></td><td data-label="Target">{percent(summary?.target)}</td><td data-label="Aktual">{percent(summary?.actual)}</td><td data-label="Selisih">{summary?.deviation == null ? '—' : `${number(summary.deviation)} poin`}</td><td data-label="Menunggu">{summary?.pendingReviews ?? 0}</td><td data-label="Masalah">{summary?.openProblems ?? 0}</td><td data-label="Aktivitas terakhir">{summary?.lastActivityAt ? new Date(summary.lastActivityAt).toLocaleString('id-ID') : 'Belum ada'}</td><td data-label="Tindakan"><a href={`/proyek/${project.id}`}>Buka</a></td></tr>)}</tbody></table></div> : <p>Tidak ada proyek yang cocok. Coba nama atau kode lain.</p>}
        </section>
      </>}
    </div>;
  }
  const needsAttention = user.role !== 'OWNER' && (data.counts.pending > 0 || (user.role === 'INSPECTOR' && (data.counts.drafts > 0 || data.counts.changes > 0)));
  const tone = (status: keyof typeof projectStatusLabels) => status === 'COMPLETED' ? 'success' : status === 'DELAYED' ? 'danger' : status === 'IN_PROGRESS' ? 'info' : 'neutral';
  return <>
    <section className={`dashboard-priority${needsAttention ? ' has-attention' : ''}`} aria-labelledby="priority-title">
      <div className="section-heading"><div><p className="eyebrow">Prioritas</p><h2 id="priority-title">{needsAttention ? 'Perlu perhatian' : 'Kondisi ruang kerja'}</h2></div></div>
      <div className="monitor-cards">
        <MetricTile label="Proyek Anda" value={data.counts.projects} emphasis />
        {user.role === 'ADMINISTRATOR' && <><MetricTile label="Proyek berjalan" value={data.counts.active} /><MetricTile label="Proyek selesai" value={data.counts.completed} /><MetricTile label="Pengguna" value={data.users} /></>}
        {user.role !== 'OWNER' && <MetricTile label="Menunggu pemeriksaan" value={data.counts.pending} helper={data.counts.pending ? 'Pilih proyek untuk membuka antrean.' : 'Tidak ada laporan yang menunggu.'} />}
        {user.role === 'INSPECTOR' && <><MetricTile label="Belum dikirim" value={data.counts.drafts} /><MetricTile label="Perlu diperbaiki" value={data.counts.changes} /></>}
      </div>
    </section>
    <div className="section-heading dashboard-project-heading"><div><p className="eyebrow">Ruang kerja</p><h2>Proyek saya</h2><p className="muted">Buka proyek untuk melihat tugas, laporan, dan kemajuan.</p></div><a className="button" href="/proyek">Cari proyek</a></div>
    {!data.projects.length && <EmptyState title="Belum ada proyek yang dapat diakses" action={['ADMINISTRATOR','TEAM_LEADER'].includes(user.role) ? <a className="button primary" href="/proyek/baru">Tambah Proyek</a> : undefined}><p>{['ADMINISTRATOR','TEAM_LEADER'].includes(user.role) ? 'Tambahkan proyek untuk mulai bekerja.' : 'Hubungi Administrator atau Team Leader untuk penugasan proyek.'}</p></EmptyState>}
    {!!data.projects.length && <div className="responsive-table"><table className="adaptive-table"><thead><tr><th>Proyek</th><th>Status</th><th>Lokasi</th><th>Pelaksanaan</th><th>Tindakan</th></tr></thead><tbody>{data.projects.map(p => <tr key={p.id}><td data-label="Proyek"><a href={`/proyek/${p.id}`}><strong>{p.projectName}</strong></a><small>{p.projectCode}</small></td><td data-label="Status"><StatusTag tone={tone(p.status)}>{projectStatusLabels[p.status]}</StatusTag></td><td data-label="Lokasi">{p.location || 'Belum diisi'}</td><td data-label="Pelaksanaan">{p.startDate} sampai {p.endDate}</td><td data-label="Tindakan"><a href={`/proyek/${p.id}`}>Buka proyek</a></td></tr>)}</tbody></table></div>}
    {user.role === 'ADMINISTRATOR' && <section className="info-panel"><h2>Aktivitas sistem terbaru</h2><History entries={data.activity} /></section>}
  </>;
}

function PeriodBarChart({ curve }: { curve: Curve }) {
  const rows = curve.points.map((point,index) => {
    const previous = curve.points[index - 1];
    const actual = point.actual === null ? null : Math.max(0, Number(point.actual) - Number(previous?.actual ?? 0));
    const targetValue = point.latest ?? point.baseline;
    const previousTarget = previous?.latest ?? previous?.baseline ?? '0';
    const target = targetValue === null ? null : Math.max(0, Number(targetValue) - Number(previousTarget));
    return { date: point.date, actual, target };
  });
  if (!rows.length) return <p className="muted">Grafik akan muncul setelah rencana ditetapkan.</p>;
  const max = Math.max(1, ...rows.flatMap(row => [row.actual ?? 0, row.target ?? 0]));
  return <><div className="bar-legend"><span><i className="bar-target" />Target</span><span><i className="bar-actual" />Aktual</span></div><div className="period-bars" role="img" aria-label="Grafik target dan aktual per periode">
    {rows.map((row,index) => <div className="period-bar-column" key={`${row.date}-${index}`}><div className="period-bar-values"><span className="period-bar target" style={{height:`${((row.target ?? 0)/max)*100}%`}} title={`Target ${row.target?.toFixed(2) ?? 'belum ada'}%`} /><span className="period-bar actual" style={{height:`${((row.actual ?? 0)/max)*100}%`}} title={`Aktual ${row.actual?.toFixed(2) ?? 'belum ada'}%`} /></div><small>{index % Math.max(1, Math.ceil(rows.length / 6)) === 0 ? row.date.slice(5) : ''}</small></div>)}
  </div><details className="disclosure"><summary>Lihat angka per periode</summary><div className="responsive-table"><table><thead><tr><th>Tanggal</th><th>Target periode</th><th>Aktual periode</th></tr></thead><tbody>{rows.map(row => <tr key={row.date}><th>{row.date}</th><td>{row.target?.toFixed(2) ?? '—'}%</td><td>{row.actual?.toFixed(2) ?? '—'}%</td></tr>)}</tbody></table></div></details></>;
}
