import { useCallback, useEffect, useRef, useState } from 'react';
import Add from '@carbon/icons-react/es/Add.js';
import type { SessionUser } from '../../../shared/contracts';
import { archiveSchema, formatRupiah, projectStatuses, projectStatusLabels, statusSchema, type Project, type ProjectMember, type ProjectStatus } from '../../../shared/projects';
import { api } from '../api';
import { EmptyState, Feedback, Field, LoadingPanel, PageHeader, StatusTag, useConfirmAction } from '../components/ui';
import { ProjectForm } from './ProjectForm';
import { ProjectTeam } from './ProjectTeam';
import { WorkItems } from './WorkItems';
import { Plans } from './Plans';
import { Progress } from './Progress';
import { PeriodReports } from './PeriodReports';
import { Exports } from './Exports';
import { ProjectMonitoring, GalleryPanel, ProjectHistory } from './Monitoring';
import { ProjectNavigation } from '../components/ProjectNavigation';
import { useQueryState, queryString } from '../query-state';
import { Reports } from './Reports';

const projectTone = (status: ProjectStatus) => status === 'COMPLETED' ? 'success' as const : status === 'DELAYED' ? 'danger' as const : status === 'IN_PROGRESS' ? 'info' as const : 'neutral' as const;

function ProjectList({ user }: { user: SessionUser }) {
  const requestNumber = useRef(0);
  const [projects, setProjects] = useState<Project[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const filter = useQueryState({q:'', status:'', archived:'false'});
  const draft=filter.values.q, query=filter.applied.q, status=filter.values.status, archived=filter.values.archived==='true';
  const setDraft=(q:string)=>filter.setValues({...filter.values,q});
  const setStatus=(status:string)=>filter.apply({...filter.values,status});
  const setArchived=(archived:boolean)=>filter.apply({...filter.values,archived:String(archived)});
  const load = useCallback(async () => {
    const currentRequest = ++requestNumber.current;
    setLoading(true); setError('');
    const params = new URLSearchParams(queryString(filter.applied));
    try { const data=await api<{ projects: Project[] }>(`/api/projects?${params}`);if(currentRequest===requestNumber.current)setProjects(data.projects); }
    catch (err) { if(currentRequest===requestNumber.current)setError(err instanceof Error ? err.message : 'Proyek belum dapat dimuat.'); }
    finally { if(currentRequest===requestNumber.current)setLoading(false); }
  }, [filter.applied]);
  useEffect(() => { void load(); }, [load]);
  return <><PageHeader eyebrow="Ruang kerja" title="Proyek" description={user.role === 'ADMINISTRATOR' ? 'Kelola proyek dan penanggung jawab tim.' : 'Proyek sesuai penugasan aktif Anda.'} actions={['ADMINISTRATOR', 'TEAM_LEADER'].includes(user.role) ? <a className="button primary" href="/proyek/baru"><Add size={18} aria-hidden="true" /> Tambah Proyek</a> : undefined} />
    <form className="project-filters" onSubmit={(event) => { event.preventDefault(); filter.apply(); }}><Field id="project-search" label="Cari proyek"><input id="project-search" type="search" placeholder="Nama, kode, kontrak, atau lokasi" value={draft} maxLength={200} onChange={(event) => setDraft(event.target.value)} /></Field><Field id="project-filter" label="Status proyek"><select id="project-filter" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua status</option>{projectStatuses.map((value) => <option key={value} value={value}>{projectStatusLabels[value]}</option>)}</select></Field><button type="submit">Cari</button><label className="checkbox-label"><input type="checkbox" checked={archived} onChange={(event) => setArchived(event.target.checked)} />Sertakan arsip</label></form>
    {loading ? <LoadingPanel /> : error ? <div className="state-panel"><Feedback error>{error}</Feedback><button onClick={() => void load()}>Coba Lagi</button></div> : !projects.length ? <EmptyState title="Belum ada proyek yang sesuai"><p>{user.role === 'ADMINISTRATOR' || user.role === 'TEAM_LEADER' ? 'Tambahkan proyek atau sesuaikan pencarian Anda.' : 'Periksa pencarian atau hubungi Administrator atau Team Leader untuk penugasan.'}</p></EmptyState> : <div className="responsive-table"><table className="adaptive-table project-data-table"><thead><tr><th>Proyek</th><th>Status</th><th>Lokasi</th><th>Pelaksanaan</th><th>Nilai kontrak</th><th>Team Leader</th><th>Tindakan</th></tr></thead><tbody>{projects.map(project => <tr key={project.id}><td data-label="Proyek"><a href={`/proyek/${project.id}`}><strong>{project.projectName}</strong></a><small>{project.projectCode}{project.archivedAt ? ' · Diarsipkan' : ''}</small></td><td data-label="Status"><StatusTag tone={projectTone(project.status)}>{projectStatusLabels[project.status]}</StatusTag></td><td data-label="Lokasi">{project.location || 'Belum diisi'}</td><td data-label="Pelaksanaan">{project.startDate}<br />sampai {project.endDate}</td><td data-label="Nilai kontrak">{formatRupiah(project.currentContractValue)}</td><td data-label="Team Leader">{project.teamLeaderName ?? 'Belum ditetapkan'}</td><td data-label="Tindakan"><a href={`/proyek/${project.id}`}>Buka proyek</a></td></tr>)}</tbody></table></div>}
  </>;
}

function ProjectDetail({ user, id, teamOnly = false }: { user: SessionUser; id: string; teamOnly?: boolean }) {
  const [project, setProject] = useState<Project | null>(null), [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState(''), [editing, setEditing] = useState(false);
  const [action, setAction] = useState<'status' | 'archive' | null>(null), [status, setStatus] = useState<ProjectStatus | ''>(''), [reason, setReason] = useState(''), [busy, setBusy] = useState(false), [actionError, setActionError] = useState('');
  const { confirm, confirmation } = useConfirmAction();
  const load = useCallback(async () => {
    setError('');
    try {
      const [detail, team] = await Promise.all([api<{ project: Project }>(`/api/projects/${id}`), teamOnly ? api<{ members: ProjectMember[] }>(`/api/projects/${id}/team`) : Promise.resolve({members: []})]);
      setProject(detail.project); setMembers(team.members); window.dispatchEvent(new Event('simp:project-updated'));
    } catch (err) { setProject(null); setError(err instanceof Error ? err.message : 'Proyek belum dapat dimuat.'); }
    finally { setLoading(false); }
  }, [id, teamOnly]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <LoadingPanel />;
  if (error || !project) return <div className="state-panel"><Feedback error>{error || 'Proyek tidak ditemukan.'}</Feedback><button onClick={() => void load()}>Coba Lagi</button> <a href="/proyek">Kembali ke Proyek</a></div>;
  if (teamOnly) return <><h1>Tim & penugasan</h1><ProjectTeam project={project} members={members} reload={load} /></>;
  if (editing) return <ProjectForm user={user} project={project} onCancel={() => setEditing(false)} onSaved={(saved) => { setProject(saved); setEditing(false); setNotice('Informasi proyek berhasil disimpan.'); void load(); }} />;
  const showAction = (value: 'status' | 'archive') => { setAction(value); setReason(''); setStatus(project.statusOverride ?? ''); setActionError(''); };
  const details: [string, string | number | null][] = [
    ['Nama kegiatan', project.activityName], ['Nama pekerjaan', project.projectName], ['Lokasi', project.location], ['Tahun anggaran', project.fiscalYear],
    ['Nomor kontrak', project.contractNumber], ['Tanggal kontrak', project.contractDate], ['Nilai kontrak awal', formatRupiah(project.initialContractValue)], ['Nilai kontrak berjalan', formatRupiah(project.currentContractValue)],
    ['Tanggal mulai', project.startDate], ['Tanggal selesai', project.endDate], ['Durasi pelaksanaan', `${project.durationDays} hari (inklusif)`], ['Pemberi pekerjaan', project.clientName],
    ['Nama instansi', project.clientAgency], ['Alamat instansi', project.clientAgencyAddress], ['Konsultan supervisi', project.consultantName], ['Nama kontraktor', project.contractorName], ['Team Leader', project.teamLeaderName], ['Keterangan', project.description],
  ];
  return <><a className="back-link" href="/proyek">← Semua Proyek</a><PageHeader eyebrow={project.projectCode} title="Informasi proyek" description={project.location} actions={project.canManage ? <button className="primary" onClick={() => setEditing(true)}>Ubah Proyek</button> : undefined} />
    {notice && <Feedback>{notice}</Feedback>}
    <details className="disclosure"><summary>Status dan tindakan proyek</summary><div className="section-heading"><h2>Status proyek</h2><StatusTag tone={projectTone(project.status)}>{projectStatusLabels[project.status]}</StatusTag></div><p>{project.statusOverride ? `Koreksi manual: ${project.statusReason}` : 'Mengikuti kemajuan yang disetujui dan jadwal yang berlaku.'}</p><p className="muted small">Status otomatis: {projectStatusLabels[project.automaticStatus]} per {project.today} ({project.timezone}). Status otomatis mengikuti kemajuan yang disetujui dan akhir jadwal efektif. Koreksi manual tetap berlaku bila ditetapkan.</p>
      {project.canManage && <div className="inline-actions"><button onClick={() => showAction('status')}>Koreksi Status</button><button className="danger-outline" onClick={() => showAction('archive')}>Arsipkan Proyek</button></div>}
      {action && <form className="team-form" noValidate onSubmit={async (event) => {
        event.preventDefault(); if (busy) return;
        const payload = action === 'status' ? { statusOverride: status || null, reason } : { confirm: true as const, reason };
        const parsed = (action === 'status' ? statusSchema : archiveSchema).safeParse(payload);
        if (!parsed.success) { setActionError(parsed.error.issues[0].message); return; }
        if (action === 'archive' && !(await confirm({ title: `Arsipkan ${project.projectName}?`, message: 'Proyek akan disembunyikan dari daftar utama dan tidak dapat diubah. Data dan riwayat tetap tersimpan.', confirmLabel: 'Arsipkan proyek', danger: true }))) return;
        setBusy(true); setActionError('');
        try { await api(`/api/projects/${id}${action === 'status' ? '/status' : ''}`, { method: action === 'status' ? 'PATCH' : 'DELETE', body: JSON.stringify(payload) }); setAction(null); setNotice(action === 'status' ? 'Status proyek berhasil diperbarui.' : 'Proyek berhasil diarsipkan.'); await load(); }
        catch (err) { setActionError(err instanceof Error ? err.message : 'Perubahan belum dapat disimpan.'); }
        finally { setBusy(false); }
      }}><h3>{action === 'status' ? 'Koreksi Status Proyek' : 'Konfirmasi Pengarsipan'}</h3>{actionError && <Feedback error>{actionError}</Feedback>}{action === 'status' && <Field id="status-override" label="Status baru"><select id="status-override" value={status} disabled={busy} onChange={(event) => setStatus(event.target.value as ProjectStatus | '')}><option value="">Ikuti tanggal otomatis</option>{projectStatuses.map((value) => <option value={value} key={value}>{projectStatusLabels[value]}</option>)}</select></Field>}<Field id="project-reason" label="Alasan perubahan"><textarea id="project-reason" rows={3} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} /></Field><div className="form-actions"><button className="primary" disabled={busy} type="submit">{busy ? 'Menyimpan…' : action === 'status' ? 'Simpan Status' : 'Konfirmasi Arsip'}</button><button type="button" disabled={busy} onClick={() => setAction(null)}>Batal</button></div></form>}
    </details>
    <section className="project-section"><h2>Data kontrak dan pelaksanaan</h2><dl className="detail-grid">{details.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === null || value === '' ? 'Belum diisi' : value}</dd></div>)}</dl></section>{confirmation}
  </>;
}

export function Projects({ user }: { user: SessionUser }) {
  const [, , segment, route, detail] = window.location.pathname.split('/');
  if (!segment) return <ProjectList user={user} />;
  if (segment === 'baru') return ['ADMINISTRATOR', 'TEAM_LEADER'].includes(user.role) ? <ProjectForm user={user} onCancel={() => window.location.assign('/proyek')} onSaved={project => window.location.assign(`/proyek/${project.id}/tim`)} /> : <Feedback error>Hanya Administrator atau Team Leader yang dapat membuat proyek.</Feedback>;
  const id = encodeURIComponent(segment);
  const page = route === 'ekspor' ? <Exports projectId={id} />
    : route === 'laporan-berkala' ? <PeriodReports projectId={id} />
    : route === 'progress' ? <Progress projectId={id} />
    : route === 'laporan' ? <Reports projectId={id} user={user} />
    : route === 'dokumentasi' ? <GalleryPanel projectId={id} initialWork={detail ?? ''} />
    : route === 'riwayat' ? <ProjectHistory projectId={id} />
    : route === 'rencana' ? <Plans projectId={id} />
    : route === 'pekerjaan' ? <WorkItems projectId={id} />
    : route === 'tim' || route === 'informasi' ? <ProjectDetail user={user} id={id} teamOnly={route === 'tim'} />
    : <ProjectMonitoring projectId={id} user={user} />;
  return <ProjectNavigation projectId={id}>{page}</ProjectNavigation>;
}
