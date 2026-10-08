import { useEffect, useRef, useState } from 'react';
import type { PeriodReport } from '../../../shared/period-reports';
import { displayDecimal } from '../../../shared/work-items';
import { api } from '../api';
import { Feedback, Field, LoadingPanel, MetricTile, PageHeader } from '../components/ui';
import '../progress.css';
import { useQueryState, queryString } from '../query-state';

const n = (v: string | null) => v === null ? '—' : `${v.startsWith('-') ? '-' : ''}${displayDecimal(v.replace(/^-/, ''), 6)}`;
const pct = (v: string | null) => v === null ? '—' : `${n(v)}%`;
const summaryPct = (v: string | null) => v === null ? '—' : `${v.startsWith('-') ? '-' : ''}${displayDecimal(v.replace(/^-/, ''), 2)}%`;
const parts = [['previous', 'Sebelumnya'], ['current', 'Periode ini'], ['cumulative', 'Total sampai tanggal ini']] as const;
export function PeriodReports({ projectId }: { projectId: string }) {
  const [data, setData] = useState<PeriodReport | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const filter=useQueryState({type:'WEEKLY',period:'',planVersionId:''});
  const {type,period,planVersionId:plan}=filter.values;
  const setType=(type:string)=>filter.setValues(v=>({...v,type})),setPeriod=(period:string)=>filter.setValues(v=>({...v,period})),setPlan=(planVersionId:string)=>filter.setValues(v=>({...v,planVersionId}));
  const request=useRef(0);
  const query = () => new URLSearchParams({ type, ...(period ? { period } : {}), ...(plan ? { planVersionId: plan } : {}) }).toString();
  async function load(params = '') {
    const current=++request.current; setLoading(true); setError('');
    try { const result = await api<PeriodReport>(`/api/projects/${projectId}/period-reports?${params}`); if(current!==request.current)return; setData(result); setPeriod(String(result.period.number)); }
    catch (err) { if(current===request.current)setError(err instanceof Error ? err.message : 'Laporan belum dapat dimuat.'); }
    finally { if(current===request.current)setLoading(false); }
  }
  useEffect(() => { void load(queryString(filter.applied)); return()=>{request.current++;}; }, [projectId,filter.applied]);
  const p = data?.progress, identity = data?.identity;
  return <><a className="back-link" href={`/proyek/${projectId}`}>Kembali ke Proyek</a><PageHeader eyebrow="LAPORAN PROYEK" title="Rekap laporan" description="Ringkasan mingguan atau bulanan dari laporan harian yang disetujui." actions={<a className="button" href={`/proyek/${projectId}/ekspor`}>Jenis rekap lainnya</a>} />
    <form className="form-grid" onSubmit={e => { e.preventDefault(); filter.apply(); }}>
      <Field id="period-type" label="Jenis laporan"><select id="period-type" value={type} disabled={loading} onChange={e => { filter.apply({...filter.values,type:e.target.value,period:''}); }}><option value="WEEKLY">Mingguan</option><option value="MONTHLY">Bulanan</option></select></Field>
      <Field id="period-number" label="Periode laporan"><select id="period-number" value={period} onChange={e => setPeriod(e.target.value)}><option value="">Periode saat ini</option>{data?.type === type && data.periods.map(part => <option value={part.number} key={part.number}>{type === 'WEEKLY' ? 'Minggu' : 'Bulan'} ke-{part.number}: {part.start} sampai {part.end}</option>)}</select></Field>
      <Field id="period-plan" label="Rencana pembanding"><select id="period-plan" value={plan} onChange={e => setPlan(e.target.value)}><option value="">Otomatis pada akhir periode</option>{p?.plans.map(v => <option key={v.id} value={v.id}>{v.name} (versi {v.versionNumber})</option>)}</select></Field>
      <div className="form-actions"><button className="primary" disabled={loading}>Tampilkan Laporan</button></div>
    </form>
    {loading ? <LoadingPanel /> : error ? <><Feedback error>{error}</Feedback><button onClick={() => void load(query())}>Coba Lagi</button></> : data && p && identity && <>
      <div className="monitor-cards progress-summary"><MetricTile label="Capaian" value={summaryPct(p.total.actual.cumulative)} emphasis /><MetricTile label="Target" value={summaryPct(p.total.target.cumulative)} /><MetricTile label="Selisih" value={`${p.total.deviation?.startsWith('-')?'-':''}${p.total.deviation===null?'—':displayDecimal(p.total.deviation.replace(/^-/,''),2)} poin`} /></div><a className="button" href={`/proyek/${projectId}/ekspor?kind=${data.type}&period=${data.period.number}&planVersionId=${p.selectedPlanId??''}`}>Pratinjau cetak / Unduh</a>
      <section className="project-section"><h2>{data.type === 'WEEKLY' ? 'Minggu' : 'Bulan'} ke-{data.period.number}</h2><p>{data.period.start} sampai {data.period.end} ({data.period.days} hari, inklusif).</p>
        <details className="disclosure"><summary>Identitas kontrak dan pelaksanaan</summary><dl className="detail-grid">{Object.entries({ 'Nama kegiatan': identity.activityName, 'Nama pekerjaan': identity.projectName, Lokasi: identity.location, 'Nomor kontrak': identity.contractNumber, 'Tanggal kontrak': identity.contractDate, 'Nilai kontrak awal': `Rp ${n(identity.initialContractValue)}`, 'Nilai kontrak berjalan': `Rp ${n(identity.currentContractValue)}`, 'Pemberi pekerjaan': identity.clientName, Konsultan: identity.consultantName, 'Team Leader saat ini': identity.teamLeaderName ?? 'Belum ditetapkan', 'Waktu pelaksanaan kontrak': `${identity.startDate} sampai ${identity.endDate}`, 'Akhir jadwal rekap': identity.scheduleEnd, 'Hari ke- pada akhir periode': identity.day, 'Sisa hari setelah periode': identity.remainingDays }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === '' ? 'Belum diisi' : value}</dd></div>)}</dl></details>
        <p>Jadwal rekap mencakup seluruh perpanjangan rencana terbit. Memilih pembanding tidak mengubah batas periode.</p>
        <p>Pembanding: {p.plans.find(v => v.id === p.selectedPlanId)?.name ?? 'Belum tersedia'}. {p.selectionMode === 'EXPLICIT' && 'Versi dipilih khusus untuk perbandingan.'}</p>
        {data.period.end > p.today && <p>Periode belum berakhir. Target mencakup seluruh periode; aktual hanya kegiatan yang sudah disetujui saat laporan dibuka.</p>}
      </section>
      {p.state !== 'READY' && <Feedback>{p.state === 'NO_BASELINE' ? 'Rencana Awal belum diterbitkan; basis progress belum tersedia.' : 'Belum ada rencana berlaku pada akhir periode.'}</Feedback>}
      {p.warning && <p>{p.warning}</p>}
      <section className="project-section"><h2>Ringkasan laporan</h2><p>Total nilai pekerjaan: Rp {n(p.basisTotalAmount)}. Nilai basis ini tidak otomatis berubah mengikuti nilai kontrak berjalan.</p>
        <div className="progress-table"><table><thead><tr><th>Periode</th><th>Kontribusi capaian</th><th>Kontribusi target</th></tr></thead><tbody>{parts.map(([key, label]) => <tr key={key}><th>{label}</th><td>{pct(p.total.actual[key])}</td><td>{pct(p.total.target[key])}</td></tr>)}</tbody></table></div>
        <p>Selisih total: {n(p.total.deviation)} poin persentase.</p>
      </section>
      <h2>Daftar pekerjaan</h2><p>Di HP, geser tabel untuk melihat kolom lainnya. Angka dibulatkan enam desimal; — berarti belum dapat dihitung.</p>
      {!p.items.length && <p>Belum ada pekerjaan dalam Rencana Awal.</p>}
      {p.items.map((item, index) => <details className="disclosure" key={item.id}><summary><span className="compact-work-summary">{index + 1}. {item.code} — {item.name}<small>{item.kind==='ITEM'?'Kemajuan fisik: '+pct(item.actual.cumulative.physical):'Kelompok pekerjaan'}</small></span></summary>
        <p>{item.kind === 'GROUP' ? 'Kelompok; hanya bobot anak dijumlahkan.' : `Satuan: ${item.unit}. Volume kontrak: ${n(item.contractVolume)}. Harga satuan: Rp ${n(item.unitPrice)}.`} Nilai pekerjaan: Rp {n(item.amount)}. Bobot: {pct(item.weight)}.</p>
        <div className="progress-table"><table><thead><tr><th>Periode</th><th>Volume aktual</th><th>Fisik aktual</th><th>Kontribusi capaian</th><th>Volume target</th><th>Fisik target</th><th>Kontribusi target</th></tr></thead><tbody>{parts.map(([key, label]) => <tr key={key}><th>{label}</th><td>{n(item.actual[key].quantity)}</td><td>{pct(item.actual[key].physical)}</td><td>{pct(item.actual[key].weighted)}</td><td>{n(item.target[key].quantity)}</td><td>{pct(item.target[key].physical)}</td><td>{pct(item.target[key].weighted)}</td></tr>)}</tbody></table></div>
        <p>Keterangan: {data.statuses[item.id]}. {item.notes}</p><p>Selisih total: {n(item.deviation)} poin persentase.</p>
      </details>)}
      <details className="disclosure"><summary>Rincian sumber dan persetujuan</summary><p>Persetujuan berikut milik laporan harian sumber, bukan tanda tangan atau pengesahan terpisah atas rekap ini. Data identitas proyek menampilkan keadaan saat dibuka.</p>
        {data.detailsRestricted && <p>Inspector hanya melihat rincian laporannya sendiri; total progress mencakup seluruh sumber sah proyek.</p>}
        {!data.reports.length && <p>Belum ada laporan harian disetujui yang dapat Anda lihat dalam periode ini. Angka sebelumnya tetap dibawa ke kumulatif.</p>}
        {data.reports.map(r => <article key={r.id}><h3><a href={`/proyek/${projectId}/laporan/${r.id}`}>{r.number} · revisi {r.revision}</a></h3><p>Tanggal kegiatan {r.date}. Disetujui {r.approvedBy} pada {new Date(r.approvedAt).toLocaleString('id-ID', { timeZone: identity.timezone })} ({identity.timezone}).</p><p>{r.notes}</p>
          <h4>Tenaga kerja</h4>{!r.workforce.length && <p>Tidak ada catatan tenaga kerja.</p>}{r.workforce.map((w, i) => <p key={i}>{w.category} / {w.position}: {w.quantity} orang pada tanggal laporan, {w.workingHours} jam kerja. {w.identity} {w.notes}</p>)}
          <h4>Material dan alat</h4>{!r.materials.length && <p>Tidak ada catatan material atau alat.</p>}{r.materials.map((m, i) => <p key={i}>{m.date}: {m.name}, {m.quantity} {m.unit}, {m.type === 'DITOLAK' ? 'Ditolak' : 'Diterima'}. {m.reason} {m.notes}</p>)}
          <h4>Masalah lapangan</h4>{!r.problems.length && <p>Tidak ada masalah tercatat.</p>}{r.problems.map((v, i) => <p key={i}>{v.date}, {v.location}: {v.problem}. Dampak: {v.impact}. Penyelesaian: {v.resolution}. Status: {v.status}. {v.notes}</p>)}
        </article>)}
        <p>Tenaga kerja dicatat per laporan/hari, bukan jumlah orang unik lintas periode. Material dengan satuan berbeda tidak dijumlahkan. Persetujuan terlambat dan koreksi dapat memperbarui angka periode lama.</p>
      </details>
    </>}
  </>;
}
