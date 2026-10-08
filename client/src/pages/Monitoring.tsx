import { useEffect, useState } from 'react';
import type { SessionUser } from '../../../shared/contracts';
import type { Dashboard, Monitoring, Gallery, HistoryEntry, Curve } from '../../../shared/monitoring';
import { displayDecimal } from '../../../shared/work-items';
import { projectStatusLabels, formatRupiah } from '../../../shared/projects';
import { reportStatuses } from '../../../shared/reports';
import { api } from '../api';
import { Feedback, Field, HistoryTimeline, LoadingPanel } from '../components/ui';
import '../progress.css';
import '../monitoring.css';
const number = (v: string | null) => v === null ? '—' : `${v.startsWith('-') ? '-' : ''}${displayDecimal(v.replace(/^-/, ''), 2)}`;
const status = (v: string) => reportStatuses[v as keyof typeof reportStatuses] ?? v;
export function History({ entries }: { entries: HistoryEntry[] }) {
  return !entries.length ? <p>Belum ada riwayat yang dapat ditampilkan.</p> : <HistoryTimeline>{entries.map(e => <article className="history-event" key={e.id}><h3>{e.action}</h3><p>{e.actor} · {new Date(e.date).toLocaleString('id-ID')}</p>{e.note && <p>{e.note}</p>}{e.status && <p>Status laporan saat ini: {status(e.status)}</p>}{e.url && <a href={e.url}>Buka sumber</a>}</article>)}</HistoryTimeline>;
}
export function Chart({ curve }: { curve: Curve }) {
  if (!curve.points.length) return <p>Rencana Awal belum tersedia. Grafik akan muncul setelah rencana diterbitkan.</p>;
  const series = [{ key: 'baseline', label: `Rencana Awal: ${curve.baseline}`, color: '#2364aa', dash: '5 4' }, { key: 'latest', label: `Rencana Terbaru / pembanding: ${curve.comparison}`, color: '#9d4d00', dash: '10 3' }, { key: 'actual', label: 'Capaian', color: '#006a4e', dash: '' }] as const;
  const x = (i: number) => 55 + (Date.parse(curve.points[i].date) - Date.parse(curve.points[0].date)) / Math.max(Date.parse(curve.points.at(-1)!.date) - Date.parse(curve.points[0].date), 1) * 650;
  const y = (v: string) => 230 - Number(v) * 2;
  return <><p>Total sampai tanggal yang dipilih. Pembanding berlaku mulai {curve.comparisonEffective}; versi masa depan ditampilkan sebagai pembanding, bukan rencana efektif ringkasan.</p>
    <div className="curve-legend">{series.map(s => <span key={s.key} style={{ color: s.color }}><svg width="36" height="14" aria-hidden="true"><line x1="0" x2="36" y1="7" y2="7" stroke={s.color} strokeWidth="3" strokeDasharray={s.dash} />{s.key === 'actual' ? <circle cx="18" cy="7" r="4" fill={s.color} /> : s.key === 'baseline' ? <rect x="14" y="3" width="8" height="8" fill={s.color} /> : <path d="M18 2 L23 7 L18 12 L13 7 Z" fill={s.color} />}</svg>{s.label}</span>)}</div>
    <p className="small muted">Di HP, geser grafik ke samping untuk membaca sumbu dan titik waktunya.</p><div className="curve-scroll" tabIndex={0} role="region" aria-label="Grafik yang dapat digeser"><svg className="progress-curve" viewBox="0 0 760 285" role="img" aria-label="Grafik Rencana Awal, Rencana Terbaru dan Capaian">
      {[0,25,50,75,100].map(v => <g key={v}><line x1="55" x2="705" y1={230-v*2} y2={230-v*2} stroke="#d9e1df" /><text x="8" y={235-v*2}>{v}%</text></g>)}
      {series.map(s => <g key={s.key}><polyline fill="none" stroke={s.color} strokeWidth="3" strokeDasharray={s.dash} points={curve.points.flatMap((p,i) => p[s.key] === null ? [] : [`${x(i)},${y(p[s.key]!)}`]).join(' ')} />{curve.points.map((p,i) => p[s.key] !== null && <g key={p.date} transform={`translate(${x(i)},${y(p[s.key]!)})`}><title>{p.date}: {s.label} {number(p[s.key])}%</title>{s.key === 'actual' ? <circle r="4" fill={s.color} /> : s.key === 'baseline' ? <rect x="-4" y="-4" width="8" height="8" fill={s.color} /> : <path d="M0 -5 L5 0 L0 5 L-5 0 Z" fill={s.color} />}</g>)}</g>)}
      <text x="55" y="252">{curve.points[0].date}</text><text x="705" y="252" textAnchor="end">{curve.points.at(-1)!.date}</text><text x="380" y="278" textAnchor="middle">Periode waktu (tanggal)</text>
    </svg></div>
    <details><summary>Lihat angka grafik</summary><div className="progress-table"><table><thead><tr><th>Tanggal</th><th>Rencana Awal (%)</th><th>Rencana Terbaru (%)</th><th>Aktual (%)</th></tr></thead><tbody>{curve.points.map(p => <tr key={p.date}><th>{p.date}</th><td>{number(p.baseline)}</td><td>{number(p.latest)}</td><td>{number(p.actual)}</td></tr>)}</tbody></table></div></details>
    <p className="muted">Aktual berhenti pada tanggal yang dipilih; angka periode lama dapat berubah karena koreksi atau persetujuan terlambat, bukan karena perubahan rencana.</p>
  </>;
}


export { DashboardPage, ProjectMonitoring, GalleryPanel, ProjectHistory } from "./MonitoringViews";
