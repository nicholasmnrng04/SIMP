import { useEffect, useRef, useState } from 'react';
import type { ProgressResult } from '../../../shared/progress';
import { displayDecimal } from '../../../shared/work-items';
import { WorkProgressTable } from '../components/WorkProgressTable';
import { api } from '../api';
import { Feedback, Field, LoadingPanel, MetricTile, PageHeader } from '../components/ui';
import '../progress.css';
import { useQueryState, queryString } from '../query-state';

const number = (value: string | null) => value === null ? '—' : `${value.startsWith('-') ? '-' : ''}${displayDecimal(value.replace(/^-/, ''), 6)}`;
const percent = (value: string | null) => value === null ? '—' : `${number(value)}%`;
const summaryPercent = (value: string | null) => value === null ? '—' : `${value.startsWith('-') ? '-' : ''}${displayDecimal(value.replace(/^-/, ''), 2)}%`;
const parts = [['previous', 'Sebelumnya'], ['current', 'Periode ini'], ['cumulative', 'Total sampai tanggal ini']] as const;

export function Progress({ projectId }: { projectId: string }) {
  const [data, setData] = useState<ProgressResult | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const filter=useQueryState({from:'',cutoff:'',planVersionId:'',workItemId:''});
  const {from,cutoff,planVersionId:plan,workItemId:work}=filter.values;
  const setFrom=(from:string)=>filter.setValues(v=>({...v,from})),setCutoff=(cutoff:string)=>filter.setValues(v=>({...v,cutoff})),setPlan=(planVersionId:string)=>filter.setValues(v=>({...v,planVersionId})),setWork=(workItemId:string)=>filter.setValues(v=>({...v,workItemId}));
  const request=useRef(0);
  async function load(params = '') {
    const current=++request.current; setLoading(true); setError('');
    try {
      const result = await api<ProgressResult>(`/api/projects/${projectId}/progress${params ? `?${params}` : ''}`);
      if(current!==request.current)return; setData(result); setFrom(result.from); setCutoff(result.cutoff);
    } catch (err) { if(current===request.current)setError(err instanceof Error ? err.message : 'Progress belum dapat dimuat.'); }
    finally { if(current===request.current)setLoading(false); }
  }
  const query = () => new URLSearchParams({ ...(from ? { from } : {}), ...(cutoff ? { cutoff } : {}), ...(plan ? { planVersionId: plan } : {}), ...(work ? { workItemId: work } : {}) }).toString();
  useEffect(() => { void load(queryString(filter.applied)); return()=>{request.current++;}; }, [projectId,filter.applied]);
  return <><a className="back-link" href={`/proyek/${projectId}`}>Kembali ke Proyek</a><PageHeader eyebrow="KEMAJUAN PROYEK" title="Rincian kemajuan" description={data?.projectName || 'Capaian pekerjaan dibandingkan dengan target proyek.'} />
    <p className="muted">Capaian berasal dari laporan yang disetujui dan masih berlaku. Rincian enam desimal tetap tersedia untuk pemeriksaan.</p>
    {data && <form className="form-grid" onSubmit={event => { event.preventDefault(); filter.apply(); }}>
      <Field id="progress-from" label="Awal periode"><input id="progress-from" type="date" required value={from} onChange={e => setFrom(e.target.value)} /></Field>
      <Field id="progress-cutoff" label="Sampai tanggal"><input id="progress-cutoff" type="date" required value={cutoff} onChange={e => setCutoff(e.target.value)} /></Field>
      <Field id="progress-plan" label="Rencana pembanding"><select id="progress-plan" value={plan} onChange={e => setPlan(e.target.value)}><option value="">Otomatis sesuai tanggal yang dipilih</option>{data.plans.map(p => <option key={p.id} value={p.id}>{p.name} (versi {p.versionNumber})</option>)}</select></Field>
      <Field id="progress-work" label="Pekerjaan"><select id="progress-work" value={work} onChange={e => setWork(e.target.value)}><option value="">Semua pekerjaan</option>{data.workItems.map(w => <option key={w.id} value={w.id}>{w.code} — {w.name}</option>)}</select></Field>
      <div className="form-actions"><button className="primary" disabled={loading}>Tampilkan Kemajuan</button></div>
    </form>}
    {loading ? <LoadingPanel /> : error ? <><Feedback error>{error}</Feedback><button onClick={() => void load(query())}>Coba Lagi</button></> : data && <>
      <p className="filter-context">Periode {data.from} sampai {data.cutoff}</p><div className="monitor-cards progress-summary"><MetricTile label="Capaian" value={summaryPercent(data.total.actual.cumulative)} emphasis /><MetricTile label="Target" value={summaryPercent(data.total.target.cumulative)} /><MetricTile label="Selisih" value={`${data.total.deviation?.startsWith('-')?'-':''}${data.total.deviation===null?'—':displayDecimal(data.total.deviation.replace(/^-/,''),2)} poin`} /></div><a className="button" href={`/proyek/${projectId}/ekspor?kind=PROGRESS&${queryString(filter.applied)}`}>Pratinjau cetak / Unduh</a>
      {data.state === 'NO_BASELINE' && <p>Rencana Awal belum diterbitkan. Terbitkan rencana untuk menyediakan perhitungan kemajuan.</p>}
      {data.state === 'NO_EFFECTIVE_PLAN' && <p>Belum ada rencana yang berlaku pada tanggal yang dipilih ini.</p>}
      {data.warning && <p>{data.warning}</p>}
      <details className="disclosure"><summary>Rencana dan dasar perhitungan</summary><p>Perhitungan capaian tetap memakai volume dan bobot Rencana Awal. Pembanding: {data.plans.find(p => p.id === data.selectedPlanId)?.name ?? 'Belum tersedia'}{data.selectedPlanId && `, berlaku mulai ${data.plans.find(p => p.id === data.selectedPlanId)?.effectiveDate}`}{data.selectionMode === 'EXPLICIT' && data.selectedPlanId !== data.effectivePlanId ? ' (pilihan perbandingan, bukan versi yang berlaku pada tanggal pilihan)' : ''}.</p></details>
      <section className="project-section"><h2>Total proyek</h2><p>Angka total tetap mencakup seluruh pekerjaan meskipun daftar di bawah difilter.</p>
        <div className="progress-table"><table><thead><tr><th>Periode</th><th>Kontribusi capaian</th><th>Kontribusi target</th></tr></thead><tbody>{parts.map(([key, label]) => <tr key={key}><th>{label}</th><td>{percent(data.total.actual[key])}</td><td>{percent(data.total.target[key])}</td></tr>)}</tbody></table></div>
        <p>Selisih total (capaian − target): <strong>{number(data.total.deviation)} poin persentase</strong></p>
      </section>
      <WorkProgressTable items={data.items} />
      <details className="disclosure"><summary>Rincian perhitungan per pekerjaan</summary>
      {!data.items.length && <p>Belum ada pekerjaan untuk ditampilkan.</p>}
      {data.items.map(item => <details className="disclosure" key={item.id}><summary><span className="compact-work-summary">{item.code} — {item.name}<small>{item.kind==='ITEM'?'Kemajuan fisik: '+percent(item.actual.cumulative.physical):'Kelompok pekerjaan'}</small></span></summary><p>{item.kind === 'GROUP' ? 'Kelompok: penjumlahan bobot anak, tanpa menjumlahkan satuan berbeda.' : `Volume kontrak ${number(item.contractVolume)} ${item.unit}. Bobot ${percent(item.weight)}.`}</p>
        <div className="progress-table"><table><thead><tr><th>Periode</th><th>Volume aktual</th><th>Fisik aktual</th><th>Kontribusi capaian</th><th>Volume target</th><th>Fisik target</th><th>Kontribusi target</th></tr></thead><tbody>{parts.map(([key, label]) => <tr key={key}><th>{label}</th><td>{number(item.actual[key].quantity)}</td><td>{percent(item.actual[key].physical)}</td><td>{percent(item.actual[key].weighted)}</td><td>{number(item.target[key].quantity)}</td><td>{percent(item.target[key].physical)}</td><td>{percent(item.target[key].weighted)}</td></tr>)}</tbody></table></div>
        <p>Selisih: {number(item.deviation)} poin persentase.</p>
      </details>)}
      </details>
      <details className="disclosure"><summary>Laporan sumber perhitungan</summary><p>{data.sourceCount} kegiatan disetujui dalam pilihan ini, termasuk kegiatan sebelum awal periode.</p>
        {data.traceRestricted && <p>Angka proyek mencakup semua laporan sah. Sebagai Inspector, rincian sumber hanya menampilkan laporan Anda sendiri.</p>}
        {!data.sourceCount && <p>Belum ada kegiatan disetujui sampai tanggal yang dipilih.</p>}
        {data.sources.map(source => <article key={source.activityId}><h3><a href={source.reportUrl}>{source.reportNumber} · revisi {source.revision}</a></h3><p>{source.description} — volume {number(source.quantity)}. Tanggal kegiatan {source.reportDate} ({source.bucket === 'previous' ? 'sebelumnya' : 'periode ini'}).</p><p className="muted">Disetujui oleh {source.approvedByName ?? '—'} pada {source.approvedAt ? new Date(source.approvedAt).toLocaleString('id-ID') : '—'}.</p></article>)}
      </details><details className="disclosure"><summary>Ketelitian angka</summary><p className="muted small">Persentase dibulatkan hingga 6 desimal pada hasil akhir. Penjumlahan angka tampilan dapat berselisih 0,000001 akibat pembulatan. Tanda — berarti belum dapat dihitung.</p></details>
    </>}
  </>;
}
