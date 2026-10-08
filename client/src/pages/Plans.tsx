import { useCallback, useEffect, useRef, useState } from 'react';
import { periods, planSchema, position, newWeekConvention, type PeriodType, type PlanContext, type PlanInput, type PlanSeries, type PlanVersion } from '../../../shared/plans';
import { displayDecimal, scaled, decimal } from '../../../shared/work-items';
import { api } from '../api';
import { ActionBar, EmptyState, Feedback, Field, LoadingPanel, PageHeader, StatusTag } from '../components/ui';
import '../plans.css';
import { useQueryState } from '../query-state';
import type { WorkbookTargetPreview } from '../../../shared/workbook-targets';
import { groupWorkItems } from '../work-item-groups';

const typeLabel = (type: PeriodType) => type === 'WEEKLY' ? 'Mingguan' : 'Bulanan';
const message = (error: unknown) => error instanceof Error ? error.message : 'Rencana belum dapat dimuat.';
const targetWeeks = (targets: string[] | null) => targets
  ? targets.map((value, index) => Number(value) ? `M${index + 1}: ${displayDecimal(value, 2)}%` : '').filter(Boolean).join(', ')
  : 'Belum ada';
function PlanEditor({ context, projectId, onClose, onSaved }: { context: PlanContext; projectId: string; onClose: () => void; onSaved: (id: string) => Promise<void> }) {
  const previous = context.versions.at(-1), basis = context.versions[0]?.basis ?? context.basis;
  const workGroups = groupWorkItems(basis), leaves = workGroups.flatMap(group => group.items);
  const [step, setStep] = useState(1), [busy, setBusy] = useState(false), [error, setError] = useState(''), [selectedWorkItemId, setSelectedWorkItemId] = useState(leaves[0]?.id ?? '');
  const [targetSchedule, setTargetSchedule] = useState(`${previous?.endDate ?? context.endDate}/${previous?.granularity ?? 'WEEKLY'}/${previous?.weekConvention ?? newWeekConvention}`);
  const [workbookPreview, setWorkbookPreview] = useState<WorkbookTargetPreview | null>(null);
  const [draft, setDraft] = useState<PlanInput>(() => ({ previousVersionId: previous?.id ?? null, basisToken: context.basisToken,
    name: previous ? `Perubahan Rencana ${context.versions.length}` : 'Rencana Awal', reason: previous ? '' : 'Penerbitan Rencana Awal', description: '',
    effectiveDate: previous ? (context.today > previous.effectiveDate ? context.today : '') : context.startDate,
    startDate: context.versions[0]?.startDate ?? context.startDate, endDate: previous?.endDate ?? context.endDate,
    granularity: previous?.granularity ?? 'WEEKLY', items: leaves.map(item => ({ workItemId: item.id, targets: [...(previous?.items.find(row => row.workItemId === item.id)?.targets ?? [])] })) }));
  let source: ReturnType<typeof periods> = [];
  try { source = periods(draft.startDate, draft.endDate, draft.granularity, newWeekConvention); } catch { /* Metadata validation displays the error on Next. */ }
  const change = <K extends keyof PlanInput>(key: K, value: PlanInput[K]) => { setError(''); setDraft(old => ({ ...old, [key]: value })); };
  function prepareTargets() {
    if (!draft.name.trim() || draft.reason.trim().length < 3 || !draft.effectiveDate || !source.length) { setError('Isi nama, alasan, tanggal berlaku dan jadwal yang valid terlebih dahulu.'); return; }
    const schedule = `${draft.endDate}/${draft.granularity}/${newWeekConvention}`, changed = targetSchedule !== schedule;
    setDraft(old => ({ ...old, items: old.items.map(item => ({ ...item, targets: changed || item.targets.length !== source.length ? source.map(() => '0') : item.targets })) }));
    setTargetSchedule(schedule); if (changed) setWorkbookPreview(null); setStep(2); setError('');
  }
  const target = draft.items.find(item => item.workItemId === selectedWorkItemId);
  const targetTotal = target?.targets.reduce((sum, value) => { try { return sum + scaled(value || '0', 6); } catch { return sum; } }, 0n) ?? 0n;
  const targetComplete = targetTotal === 100000000n;
  return <section className="project-section plan-editor"><div className="section-heading"><h2>{previous ? 'Buat Perubahan Rencana' : 'Buat Rencana Awal'}</h2><button disabled={busy} onClick={onClose}>Batal</button></div>
    <p className="muted">Langkah {step} dari 3 · {step === 1 ? 'Identitas dan jadwal' : step === 2 ? 'Target pekerjaan' : 'Periksa dan tetapkan'}</p>
    {error && <Feedback error>{error}</Feedback>}
    <form noValidate onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      if (step === 1) { prepareTargets(); return; }
      const parsed = planSchema.safeParse(draft);
      if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
      const invalidItem = draft.items.find(item => item.targets.reduce((sum, value) => sum + scaled(value, 6), 0n) !== 100000000n);
      if (invalidItem) {
        const work = leaves.find(item => item.id === invalidItem.workItemId);
        setSelectedWorkItemId(invalidItem.workItemId);
        setError(`Jumlah target ${work?.code ?? 'pekerjaan ini'}${work ? ` · ${work.name}` : ''} harus tepat 100%. Pekerjaan yang perlu diperbaiki sudah dipilih.`);
        window.requestAnimationFrame(() => document.getElementById('plan-item')?.focus());
        return;
      }
      if (step === 2) { setStep(3); setError(''); return; }
      setBusy(true); setError('');
      try { const result = await api<{ id: string }>(`/api/projects/${projectId}/plans`, { method: 'POST', body: JSON.stringify(draft) }); await onSaved(result.id); }
      catch (err) { setError(message(err)); }
      finally { setBusy(false); }
    }}>
      <fieldset disabled={busy}>
      {step === 1 && <div className="form-grid">
        <Field id="plan-name" label="Nama versi"><input id="plan-name" value={draft.name} maxLength={150} onChange={e => change('name', e.target.value)} /></Field>
        <Field id="plan-effective" label="Tanggal berlaku"><input id="plan-effective" type="date" disabled={!previous} value={draft.effectiveDate} onChange={e => change('effectiveDate', e.target.value)} /></Field>
        <Field id="plan-start" label="Tanggal mulai"><input id="plan-start" type="date" value={draft.startDate} disabled /></Field>
        <Field id="plan-end" label="Tanggal selesai versi"><input id="plan-end" type="date" disabled={!previous} value={draft.endDate} onChange={e => change('endDate', e.target.value)} /></Field>
        <Field id="plan-type" label="Sumber target"><select id="plan-type" value={draft.granularity} onChange={e => change('granularity', e.target.value as PeriodType)}><option value="WEEKLY">Mingguan</option><option value="MONTHLY">Bulanan</option></select></Field>
        <Field id="plan-reason" label="Alasan"><textarea id="plan-reason" value={draft.reason} maxLength={1000} onChange={e => change('reason', e.target.value)} /></Field>
        <Field id="plan-description" label="Penjelasan perubahan"><textarea id="plan-description" value={draft.description} maxLength={5000} onChange={e => change('description', e.target.value)} /></Field>
        <p className="muted small">Target dibagi merata per hari dalam periode sumber. Jika jenis periode atau tanggal selesai berubah, target perlu diisi ulang. Versi terbit tetap tersimpan utuh.</p>
      </div>}
      {step === 2 && <><Field id="plan-item" label="Pekerjaan yang diatur"><select id="plan-item" value={selectedWorkItemId} onChange={e => setSelectedWorkItemId(e.target.value)}>{workGroups.map(group => <optgroup key={group.items[0].id} label={group.label}>{group.items.map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</optgroup>)}</select></Field>
        <div className={`target-total${targetComplete?' complete':''}`}><span>Total target pekerjaan ini</span><strong>{displayDecimal(decimal(targetTotal, 6), 2)}%</strong><StatusTag tone={targetComplete?'success':'warning'}>{targetComplete?'Siap diperiksa':'Harus tepat 100%'}</StatusTag></div>
        <p className="muted">Isi tambahan target fisik tiap periode, bukan angka kumulatif. Jumlah setiap pekerjaan wajib 100%. Semua {leaves.length} item harus terisi, termasuk item nonaktif atau bernilai nol.</p>
        {draft.granularity === 'WEEKLY' && <><button type="button" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { setWorkbookPreview(await api<WorkbookTargetPreview>(`/api/projects/${projectId}/plans/workbook-targets`)); } catch (err) { setError(message(err)); } finally { setBusy(false); } }}>Pratinjau target dari workbook TS</button>
          {workbookPreview && <section className="project-section"><h3>Target workbook TS</h3>
            <p>{workbookPreview.items.length} pekerjaan, {workbookPreview.weeks} minggu. {workbookPreview.changedCount} pekerjaan berbeda dari versi terakhir. Satuan, volume, dan harga sudah dicocokkan. Pratinjau ini belum menerbitkan rencana.</p>
            {workbookPreview.previousWeekConvention === 'PROJECT_START' && <p className="muted">Minggu versi sebelumnya dihitung sejak tanggal mulai proyek; minggu workbook TS dihitung Senin–Minggu. Bandingkan pola target bersama tanggal periodenya sebelum menetapkan versi baru.</p>}
            <div className="responsive-table"><table><thead><tr><th>Kode</th><th>Uraian</th><th>Status</th><th>Satuan</th><th>Volume</th><th>Harga satuan</th><th>Target versi sebelumnya</th><th>Target workbook TS</th></tr></thead><tbody>{workbookPreview.items.map(item => <tr key={item.workItemId}><td>{item.code}</td><td>{item.name}</td><td>{item.previousTargets ? item.changed ? 'Berbeda' : 'Sama' : 'Baru'}</td><td>{item.unit}</td><td>{item.contractVolume}</td><td>{item.unitPrice}</td><td>{targetWeeks(item.previousTargets)}</td><td>{targetWeeks(item.targets)}</td></tr>)}</tbody></table></div>
            <button type="button" onClick={() => { const targets = new Map(workbookPreview.items.map(item => [item.workItemId, item.targets])); change('items', draft.items.map(item => ({ ...item, targets: [...targets.get(item.workItemId)!] }))); }}>Gunakan target workbook TS</button>
          </section>}</>}
        <button type="button" onClick={() => { const base = 100000000n / BigInt(source.length), remainder = 100000000n % BigInt(source.length); change('items', draft.items.map(item => item.workItemId === selectedWorkItemId ? { ...item, targets: source.map((_, p) => decimal(base + (p === source.length - 1 ? remainder : 0n), 6)) } : item)); }}>Bagi Rata Pekerjaan Ini</button>
        <div className="plan-targets">{source.map((period, index) => <Field key={period.number} id={`target-${index}`} label={`${draft.granularity === 'WEEKLY' ? 'Minggu' : 'Bulan'} ${period.number} · ${period.start} — ${period.end} (%)`}><input id={`target-${index}`} inputMode="decimal" value={target?.targets[index] ?? ''} onChange={e => change('items', draft.items.map(item => item.workItemId === selectedWorkItemId ? { ...item, targets: item.targets.map((value, p) => p === index ? e.target.value.replace(',', '.') : value) } : item))} /></Field>)}</div>
      </>}
      {step === 3 && <><h3>{draft.name}</h3><p>Berlaku {draft.effectiveDate} · {typeLabel(draft.granularity)} · {source.length} periode · {leaves.length} pekerjaan</p><p>Pelaksanaan versi: {draft.startDate} — {draft.endDate}</p><p>Alasan: {draft.reason}</p><p>{draft.description}</p><Feedback>{previous ? 'Penerbitan membuat versi baru. Versi sebelumnya dan basis perhitungan tetap tersimpan.' : 'Penerbitan Rencana Awal mengunci volume, harga, satuan dan struktur pekerjaan. Perubahan target berikutnya dibuat sebagai versi baru.'}</Feedback></>}
      </fieldset>
      <ActionBar sticky>{step > 1 && <button type="button" disabled={busy} onClick={() => { setStep(step - 1); setError(''); }}>Sebelumnya</button>}<button type="submit" disabled={busy} className="primary">{busy ? 'Menetapkan…' : step === 1 ? 'Lanjut ke Target' : step === 2 ? 'Periksa Rencana' : 'Tetapkan Rencana'}</button></ActionBar>
    </form>
  </section>;
}

function Series({ projectId, version, type }: { projectId: string; version: PlanVersion; type: PeriodType }) {
  const [data, setData] = useState<PlanSeries | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0), [selectedItem, setSelectedItem] = useState('');
  const workGroups = groupWorkItems(version.basis);
  useEffect(() => { let active = true; setData(null); setError(''); setSelectedItem('');
    void api<PlanSeries>(`/api/projects/${projectId}/plans/${version.id}/series?type=${type}`).then(result => { if (active) setData(result); }).catch(err => { if (active) setError(message(err)); });
    return () => { active = false; };
  }, [projectId, version.id, type, retry]);
  if (error) return <><Feedback error>{error}</Feedback><button onClick={() => setRetry(retry + 1)}>Coba Lagi Angka</button></>;
  if (!data) return <LoadingPanel />;
  const item = data.items.find(row => row.workItemId === selectedItem);
  return <><label className="plan-series-choice">Rincian angka<select aria-label={`Rincian ${version.name}`} value={selectedItem} onChange={e => setSelectedItem(e.target.value)}><option value="">Total proyek tertimbang</option>{workGroups.map(group => <optgroup key={group.items[0].id} label={group.label}>{group.items.map(row => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</optgroup>)}</select></label>
    <div className="responsive-table"><table className="adaptive-table plan-period-table"><thead><tr><th>Periode</th><th>Rentang tanggal</th><th>{item ? 'Target fisik' : 'Target tertimbang'}</th><th>Total sampai periode</th>{item && <th>Volume target</th>}</tr></thead><tbody>{data.periods.map((p,index) => <tr key={p.number}><th data-label="Periode">{type === 'WEEKLY' ? 'Minggu' : 'Bulan'} {p.number}</th><td data-label="Rentang tanggal">{p.start} — {p.end}<small>{p.days} hari</small></td><td data-label={item ? 'Target fisik' : 'Target tertimbang'}>{displayDecimal(item?.targets[index] ?? p.weighted)}%</td><td data-label="Total sampai periode">{displayDecimal(item?.cumulative[index] ?? p.cumulative)}%</td>{item && <td data-label="Volume target">{displayDecimal(item.quantities[index],6)} {version.basis.find(row => row.id === item.workItemId)?.unit}</td>}</tr>)}</tbody></table></div></>;
}

export function Plans({ projectId }: { projectId: string }) {
  const filter=useQueryState({cutoff:'',version:'',compare:'',type:'WEEKLY'});
  const request=useRef(0);
  const [context, setContext] = useState<PlanContext | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [editing, setEditing] = useState(false);
  const [cutoff, setCutoff] = useState(''), [selected, setSelected] = useState(''), [compare, setCompare] = useState(''), [type, setType] = useState<PeriodType>('WEEKLY');
  const load = useCallback(async () => {const current=++request.current;setError('');try{const result=await api<PlanContext>(`/api/projects/${projectId}/plans${filter.applied.cutoff?'?cutoff='+encodeURIComponent(filter.applied.cutoff):''}`);if(current!==request.current)return;setContext(result);setCutoff(result.cutoff);setSelected(result.versions.some(v=>v.id===filter.applied.version)?filter.applied.version:result.effectiveVersionId??result.versions.at(-1)?.id??'');setCompare(filter.applied.compare);setType(filter.applied.type==='MONTHLY'?'MONTHLY':'WEEKLY');}catch(err){if(current===request.current)setError(message(err));}},[projectId,filter.applied]);
  useEffect(()=>{void load();return()=>{request.current++;};},[load]);
  if (error) return <><Feedback error>{error}</Feedback><button onClick={() => void load()}>Coba Lagi</button></>;
  if (!context) return <LoadingPanel />;
  const version = context.versions.find(v => v.id === selected), comparison = context.versions.find(v => v.id === compare);
  const effective = context.versions.find(v => v.id === context.effectiveVersionId);
  const canStart = context.canPublish && context.basis.some(item => item.kind === 'ITEM');
  let datePosition: ReturnType<typeof position> | null = null;
  if (effective) datePosition = position(effective.startDate, effective.endDate, context.cutoff, effective.weekConvention);
  return <><a className="back-link" href={`/proyek/${projectId}`}>← Ringkasan proyek</a><PageHeader eyebrow="RENCANA PEKERJAAN" title="Jadwal & target" description="Rencana awal dan setiap perubahan tersimpan sebagai versi terpisah." actions={canStart && !editing && <button className="primary" onClick={() => { setEditing(true); setNotice(''); }}>{context.versions.length ? 'Buat Perubahan Rencana' : 'Buat Rencana Awal'}</button>} />
    {notice && <Feedback>{notice}</Feedback>}
    {editing && <PlanEditor key={`${projectId}/${context.versions.at(-1)?.id ?? 'awal'}`} context={context} projectId={projectId} onClose={() => setEditing(false)} onSaved={async id => { filter.apply({...filter.applied,version:id}); setEditing(false); setNotice('Rencana berhasil diterbitkan.'); }} />}
    {!context.versions.length ? <EmptyState title="Belum ada rencana awal" action={<a className="button primary" href={`/proyek/${projectId}/pekerjaan`}>Buka Daftar Pekerjaan</a>}><p>Lengkapi pekerjaan bernilai positif, lalu Team Leader dapat mengatur target dan menetapkan rencana awal.</p></EmptyState> : <>
      <section className="project-section"><h2>Rencana berlaku pada tanggal</h2><form className="inline-actions" onSubmit={event=>{event.preventDefault();filter.apply({...filter.applied,cutoff,version:''});}}><Field id="plan-cutoff" label="Tanggal pemeriksaan"><input id="plan-cutoff" type="date" required value={cutoff} onChange={e => setCutoff(e.target.value)} /></Field><button type="submit">Tampilkan yang Berlaku</button></form><p data-testid="effective-plan">{effective ? `${effective.name} · berlaku sejak ${effective.effectiveDate}` : 'Belum ada versi yang berlaku pada tanggal ini.'}</p>{datePosition && <p className="muted">Hari ke-{datePosition.day ?? '—'} · Minggu ke-{datePosition.week ?? '—'} · Bulan ke-{datePosition.month ?? '—'} · Sisa {datePosition.remainingDays} hari</p>}<p className="small muted">Jadwal efektif mengikuti versi ini. Jadwal kontrak pada informasi proyek dan data saat rencana sebelumnya ditetapkan tetap tersimpan.</p></section>
      <section className="project-section"><h2>Target pekerjaan</h2><details className="disclosure"><summary>Riwayat dan perbandingan rencana</summary><div className="form-grid"><Field id="plan-version" label="Versi yang ditampilkan"><select id="plan-version" value={selected} onChange={e => filter.apply({...filter.applied,version:e.target.value})}><option value="">Pilih versi</option>{context.versions.map(v => <option key={v.id} value={v.id}>V{v.versionNumber} · {v.name}{v.isBaseline ? ' · Rencana Awal' : ''}</option>)}</select></Field><Field id="plan-compare" label="Bandingkan dengan"><select id="plan-compare" value={compare} onChange={e => filter.apply({...filter.applied,version:selected,compare:e.target.value})}><option value="">Tanpa perbandingan</option>{context.versions.filter(v => v.id !== selected).map(v => <option key={v.id} value={v.id}>V{v.versionNumber} · {v.name}</option>)}</select></Field><Field id="plan-display-type" label="Tampilan periode"><select id="plan-display-type" value={type} onChange={e => filter.apply({...filter.applied,version:selected,type:e.target.value})}><option value="WEEKLY">Mingguan</option><option value="MONTHLY">Bulanan</option></select></Field></div>
      <p className="small muted">Angka tampilan dibulatkan; perhitungan memakai angka lengkap. Target periode lain diturunkan dari alokasi harian, bukan jadwal terpisah.</p>
      </details><div className="plan-comparison">{[version, comparison?.id !== version?.id ? comparison : undefined].filter((v): v is PlanVersion => Boolean(v)).map(v => <article className="plan-version" key={v.id}><h3>V{v.versionNumber} · {v.name}</h3><p>{v.isBaseline ? 'Rencana Awal · ' : ''}{v.id === context.effectiveVersionId ? 'Berlaku pada tanggal pemeriksaan' : v.effectiveDate > context.cutoff ? 'Belum berlaku' : 'Digantikan versi berikutnya'}</p><p className="small">{v.startDate} — {v.endDate} · Berlaku {v.effectiveDate} · Sumber {typeLabel(v.granularity)}</p><details><summary>Alasan dan rincian perubahan</summary><p className="small">Dibuat {new Date(v.createdAt).toLocaleString('id-ID')} oleh {v.createdByName}</p><p>Alasan: {v.reason}</p><p>{v.description}</p><details><summary>{v.changedItemIds.length} pekerjaan berubah{v.scheduleChanged ? ' · jadwal/sumber periode berubah' : ''}</summary><ul>{v.changedItemIds.map(id => <li key={id}>{v.basis.find(item => item.id === id)?.code} · {v.basis.find(item => item.id === id)?.name}</li>)}</ul></details></details><Series projectId={projectId} version={v} type={type} /></article>)}</div></section>
    </>}
  </>;
}
