import { useEffect, useState, type ReactNode } from 'react';
import { projectStatusLabels, type Project } from '../../../shared/projects';
import { api } from '../api';
import { Feedback, LoadingPanel, StatusTag } from './ui';

const pageLabels: Record<string, string> = {
  '': 'Ringkasan', ringkasan: 'Ringkasan', laporan: 'Laporan Harian',
  'laporan-berkala': 'Rekap & Unduhan', ekspor: 'Rekap & Unduhan',
  pekerjaan: 'Daftar Pekerjaan', rencana: 'Jadwal & Target',
  dokumentasi: 'Dokumentasi', tim: 'Tim', informasi: 'Informasi Proyek',
  progress: 'Rincian Kemajuan', riwayat: 'Riwayat Proyek',
};

export function ProjectNavigation({ projectId, children }: { projectId: string; children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError('');
    api<{ project: Project }>(`/api/projects/${projectId}`).then(data => { if (active) setProject(data.project); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Proyek belum dapat dimuat.'); });
    return () => { active = false; };
  }, [projectId, retry]);
  useEffect(() => {
    const refresh = () => setRetry(value => value + 1);
    window.addEventListener('simp:project-updated', refresh);
    return () => window.removeEventListener('simp:project-updated', refresh);
  }, []);
  const route = window.location.pathname.split('/')[3] ?? '';
  const label = pageLabels[route] ?? 'Ringkasan';
  const statusTone = project?.status === 'COMPLETED' ? 'success' : project?.status === 'DELAYED' ? 'danger' : project?.status === 'IN_PROGRESS' ? 'info' : 'neutral';
  if (error) return <><Feedback error>{error}</Feedback><button onClick={() => setRetry(retry + 1)}>Coba Lagi</button><a className="button" href="/proyek">Kembali ke Proyek</a></>;
  if (!project) return <LoadingPanel />;
  return <div className="project-workspace">
    <header className="project-context project-context-compact">
      <a className="project-back-mobile" href="/proyek">← Semua proyek</a>
      <div className="project-context-copy"><div><p className="project-context-section">{label}</p><p className="project-name">{project.projectName}</p><span className="muted">{project.projectCode}{project.location ? ` · ${project.location}` : ''}</span></div><StatusTag tone={statusTone}>{projectStatusLabels[project.status]}</StatusTag></div>
      {project.archivedAt && <Feedback>Proyek diarsipkan dan hanya dapat dibaca. Alasan: {project.archiveReason}</Feedback>}
    </header>
    <div className="project-content">{children}</div>
  </div>;
}
