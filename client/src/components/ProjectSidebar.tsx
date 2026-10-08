import { useEffect, useMemo, useState } from 'react';
import Calendar from '@carbon/icons-react/es/Calendar.js';
import Dashboard from '@carbon/icons-react/es/Dashboard.js';
import Document from '@carbon/icons-react/es/Document.js';
import Download from '@carbon/icons-react/es/Download.js';
import Group from '@carbon/icons-react/es/Group.js';
import Image from '@carbon/icons-react/es/Image.js';
import Information from '@carbon/icons-react/es/Information.js';
import List from '@carbon/icons-react/es/List.js';
import type { Project } from '../../../shared/projects';
import { projectStatusLabels } from '../../../shared/projects';
import { api } from '../api';
import { StatusTag } from './ui';

const projectDestinations = [
  { key: '', label: 'Ringkasan', icon: Dashboard },
  { key: 'laporan', label: 'Laporan Harian', icon: Document },
  { key: 'laporan-berkala', label: 'Rekap & Unduhan', icon: Download },
  { key: 'dokumentasi', label: 'Dokumentasi', icon: Image },
  { key: 'pekerjaan', label: 'Daftar Pekerjaan', icon: List },
  { key: 'rencana', label: 'Jadwal & Target', icon: Calendar },
  { key: 'tim', label: 'Tim', icon: Group },
  { key: 'informasi', label: 'Informasi Proyek', icon: Information },
] as const;
const destinationGroups = [
  { title: 'Pemantauan', destinations: projectDestinations.slice(0, 4) },
  { title: 'Pengaturan proyek', destinations: projectDestinations.slice(4) },
];

const sectionForRoute = (route: string) => route === 'ekspor' ? 'laporan-berkala'
  : route === 'progress' || route === 'riwayat' ? ''
  : projectDestinations.some(item => item.key === route) ? route : route === 'ringkasan' ? '' : '';

export function ProjectSidebar({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  const segments = path.split('/').filter(Boolean);
  const projectId = segments[0] === 'proyek' && segments[1] && segments[1] !== 'baru' ? decodeURIComponent(segments[1]) : '';
  const route = projectId ? (segments[2] ?? '') : '';
  const activeSection = sectionForRoute(route);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api<{ projects: Project[] }>('/api/projects?archived=false').then(data => {
      if (!active) return;
      setProjects(data.projects);
      setError('');
    }).catch(() => { if (active) setError('Daftar proyek belum dapat dimuat.'); });
    return () => { active = false; };
  }, [path]);

  const current = useMemo(() => projects.find(project => project.id === projectId), [projects, projectId]);
  const statusTone = current?.status === 'COMPLETED' ? 'success' : current?.status === 'DELAYED' ? 'danger' : current?.status === 'IN_PROGRESS' ? 'info' : 'neutral';
  const switchProject = (nextId: string) => {
    if (!nextId) { window.location.assign('/proyek'); return; }
    const suffix = projectId && route && !['progress', 'riwayat'].includes(route) ? `/${sectionForRoute(route)}` : '';
    window.location.assign(`/proyek/${encodeURIComponent(nextId)}${suffix}`);
  };

  return <section className="sidebar-project" aria-labelledby="active-project-label">
    <p className="nav-label" id="active-project-label">PROYEK AKTIF</p>
    <label className="sidebar-project-picker"><span className="sr-only">Pilih proyek aktif</span>
      <select aria-label="Pilih proyek aktif" value={projectId} onChange={event => switchProject(event.target.value)}>
        <option value="">Pilih proyek</option>
        {projects.map(project => <option key={project.id} value={project.id}>{project.projectName}</option>)}
      </select>
    </label>
    {error && <p className="sidebar-project-error">{error}</p>}
    {current && <div className="sidebar-project-summary"><strong title={current.projectName}>{current.projectName}</strong><span>{current.projectCode}</span><StatusTag tone={statusTone}>{projectStatusLabels[current.status]}</StatusTag></div>}
    {projectId && <nav className="project-sidebar-nav" aria-label="Bagian proyek">
      {destinationGroups.map(({ title, destinations }) => <div className="project-nav-group" key={title}><p className="nav-label">{title}</p>{destinations.map(({ key, label, icon: Icon }) => {
        const href = `/proyek/${encodeURIComponent(projectId)}${key ? `/${key}` : ''}`;
        const selected = activeSection === key;
        return <a key={key} href={href} aria-current={selected ? 'page' : undefined} onClick={onNavigate}><Icon size={18} aria-hidden="true" />{label}</a>;
      })}</div>)}
    </nav>}
  </section>;
}
