import { filterWorkRows } from '../components/WorkProgressTable';
import { useCallback, useEffect, useState } from 'react';
import type { Project } from '../../../shared/projects';
import { displayDecimal, workItemDefaults, workItemSchema, type WorkItem, type WorkItemInput, type WorkList } from '../../../shared/work-items';
import { api, ApiError } from '../api';
import { ActionBar, EmptyState, Feedback, Field, LoadingPanel, MetricTile, PageHeader, useConfirmAction } from '../components/ui';
import '../work-items.css';
import type { WorkbookWork } from '../../../shared/workbook-work';

const identityFields = ['code', 'name', 'parentId', 'description'];
function WorkEditor({ project, list, initial, onCancel, onSaved }: { project: Project; list: WorkList; initial: { item?: WorkItem; kind: 'GROUP' | 'ITEM' }; onCancel: () => void; onSaved: () => Promise<void> }) {
  const [data, setData] = useState<WorkItemInput>(initial.item ? Object.fromEntries(Object.keys(workItemDefaults).map((key) => [key, initial.item![key as keyof WorkItemInput]])) as WorkItemInput : { ...workItemDefaults, kind: initial.kind });
  const [step, setStep] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(''), [errors, setErrors] = useState<Record<string, string>>({});
  const excluded = new Set<string>(initial.item ? [initial.item.id] : []);
  // DTO disusun preorder; turunan tidak boleh dipilih menjadi induk.
  for (const item of list.items) if (item.parentId && excluded.has(item.parentId)) excluded.add(item.id);
  const parents = list.items.filter((item) => item.kind === 'GROUP' && !excluded.has(item.id));
  const locked = !!list.frozenAt;
  function update<K extends keyof WorkItemInput>(key: K, value: WorkItemInput[K]) {
    setData((old) => ({ ...old, [key]: value })); setErrors((old) => ({ ...old, [key]: '' }));
  }
  function field(key: keyof WorkItemInput, label: string, type = 'text', basis = false, hint?: string) {
    const id = `work-${key}`;
    return <Field key={key} id={id} label={label} error={errors[key]} hint={hint}><input id={id} type={type} disabled={busy || (basis && locked)} value={data[key] ?? ''} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${id}-error` : hint ? `${id}-hint` : undefined} inputMode={key === 'contractVolume' || key === 'unitPrice' ? 'decimal' : undefined}
      onChange={(event) => update(key, key === 'startDate' || key === 'endDate' ? event.target.value || null : key === 'contractVolume' || key === 'unitPrice' ? event.target.value.replace(',', '.') : event.target.value)} /></Field>;
  }
  return <section className="editor-card" aria-label="Form pekerjaan"><div className="section-heading"><h2>{initial.item ? 'Ubah' : 'Tambah'} {data.kind === 'GROUP' ? 'Kelompok' : 'Pekerjaan'}</h2><button type="button" disabled={busy} onClick={onCancel}>Batal</button></div>
    <ol className="form-steps" aria-label="Tahapan pekerjaan"><li aria-current={step === 0 ? 'step' : undefined}><span>1</span>Identitas dan kelompok</li><li aria-current={step === 1 ? 'step' : undefined}><span>2</span>Volume, harga dan jadwal</li></ol>
    {error && <Feedback error>{error}</Feedback>}{locked && <p className="muted">Basis terkunci; nama, uraian, status dan keterangan tetap dapat diperbarui.</p>}
    <form noValidate onSubmit={async (event) => {
      event.preventDefault(); if (busy) return;
      const result = workItemSchema.safeParse(data), next: Record<string, string> = {};
      if (!result.success) for (const issue of result.error.issues) if (step || identityFields.includes(String(issue.path[0]))) next[String(issue.path[0])] ??= issue.message;
      if (step && data.startDate && data.endDate && (data.startDate < project.startDate || data.endDate > project.endDate)) next.startDate = 'Jadwal pekerjaan harus berada dalam tanggal pelaksanaan proyek.';
      setErrors(next);
      if (Object.keys(next).length) { if (identityFields.some((key) => next[key])) setStep(0); return; }
      if (step === 0) { setStep(1); return; }
      setBusy(true); setError('');
      try { await api(`/api/projects/${project.id}/work-items${initial.item ? `/${initial.item.id}` : ''}`, { method: initial.item ? 'PATCH' : 'POST', body: JSON.stringify(data) }); await onSaved(); }
      catch (err) { setError(err instanceof Error ? err.message : 'Pekerjaan belum dapat disimpan.'); if (err instanceof ApiError) { setErrors(err.fields); if (identityFields.some((key) => err.fields[key])) setStep(0); } setBusy(false); }
    }}>
      {step === 0 && <><div className="form-grid">{field('code', 'Kode pekerjaan *', 'text', true)}{field('name', data.kind === 'GROUP' ? 'Nama kelompok *' : 'Nama pekerjaan *')}
        <Field id="work-parent" label="Kelompok induk" error={errors.parentId}><select id="work-parent" value={data.parentId ?? ''} disabled={busy || locked} onChange={(event) => update('parentId', event.target.value || null)}><option value="">Tanpa induk (tingkat utama)</option>{parents.map((parent) => <option key={parent.id} value={parent.id}>{parent.code} — {parent.name}</option>)}</select></Field>
        <Field id="work-kind" label="Jenis"><input id="work-kind" value={data.kind === 'GROUP' ? 'Kelompok (agregat turunan)' : 'Item pekerjaan'} readOnly /></Field></div>
        <Field id="work-description" label="Uraian" error={errors.description}><textarea id="work-description" rows={3} value={data.description} disabled={busy} onChange={(event) => update('description', event.target.value)} /></Field></>}
      {step === 1 && <><div className="form-grid">{data.kind === 'ITEM' ? <>{field('unit', 'Satuan *', 'text', true, 'Contoh: m³, m², meter, unit atau ls.')}{field('contractVolume', 'Volume kontrak *', 'text', true, 'Tanpa pemisah ribuan, maksimal 6 angka desimal.')}{field('unitPrice', 'Harga satuan (Rp) *', 'text', true, 'Tanpa pemisah ribuan, maksimal 2 angka desimal.')}</> : <p className="muted">Nilai kelompok berasal dari item turunannya. Kelompok tidak mempunyai volume atau harga sendiri.</p>}
        <Field id="work-status" label="Status pekerjaan"><select id="work-status" value={data.status} disabled={busy} onChange={(event) => update('status', event.target.value as WorkItemInput['status'])}><option value="ACTIVE">Aktif</option><option value="INACTIVE">Nonaktif</option></select></Field>
        {field('startDate', 'Tanggal mulai pekerjaan', 'date', true)}{field('endDate', 'Tanggal selesai pekerjaan', 'date', true)}</div>
        <p className="muted small">Tanggal boleh kosong. Jika diisi, keduanya harus berada dalam {project.startDate} — {project.endDate}. Status nonaktif tetap termasuk basis kontrak dan bobot.</p>
        <Field id="work-notes" label="Keterangan" error={errors.notes}><textarea id="work-notes" rows={3} value={data.notes} disabled={busy} onChange={(event) => update('notes', event.target.value)} /></Field><p className="muted small">Jumlah harga dan bobot dihitung otomatis setelah disimpan.</p></>}
      <ActionBar sticky>{step > 0 && <button type="button" disabled={busy} onClick={() => setStep(0)}>Sebelumnya</button>}<button className="primary" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : step === 0 ? 'Lanjut' : 'Simpan Pekerjaan'}</button></ActionBar>
    </form>
  </section>;
}

export function WorkItems({ projectId }: { projectId: string }) {
  const [search, setSearch] = useState(''), [group, setGroup] = useState('');
  const [workbook, setWorkbook] = useState<WorkbookWork | null>(null);
  const [project, setProject] = useState<Project | null>(null), [list, setList] = useState<WorkList | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{ item?: WorkItem; kind: 'GROUP' | 'ITEM' } | null>(null);
  const { confirm, confirmation } = useConfirmAction();
  const load = useCallback(async () => {
    setError('');
    try { const [detail, work] = await Promise.all([api<{ project: Project }>(`/api/projects/${projectId}`), api<WorkList>(`/api/projects/${projectId}/work-items`)]); setProject(detail.project); setList(work); }
    catch (err) { setProject(null); setList(null); setError(err instanceof Error ? err.message : 'Pekerjaan belum dapat dimuat.'); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <LoadingPanel />;
  if (!project || !list) return <div className="state-panel"><Feedback error>{error || 'Pekerjaan belum dapat dimuat.'}</Feedback><button onClick={() => void load()}>Coba Lagi</button> <a href="/proyek">Kembali ke Proyek</a></div>;
  return <><a className="back-link" href={`/proyek/${project.id}`}>← Ringkasan proyek</a><PageHeader eyebrow={`${project.projectCode} · ${project.projectName}`} title="Daftar Pekerjaan" description="Susun pekerjaan proyek, lalu lanjutkan ke Jadwal & target." actions={list.canManage && !list.frozenAt ? <><button disabled={busy} onClick={() => { setEditor({ kind: 'GROUP' }); setNotice(''); }}>Tambah Kelompok</button><button className="primary" disabled={busy} onClick={() => { setEditor({ kind: 'ITEM' }); setNotice(''); }}>Tambah Pekerjaan</button></> : undefined} />
    {error && <Feedback error>{error}</Feedback>}{notice && <Feedback>{notice}</Feedback>}
    {list.canManage && !list.frozenAt && !list.items.length && <button disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try { setWorkbook(await api<WorkbookWork>(`/api/projects/${projectId}/work-items/workbook`)); }
      catch (err) { setError(err instanceof Error ? err.message : 'Workbook belum dapat dimuat.'); }
      finally { setBusy(false); }
    }}>Lihat Pekerjaan dari Workbook TS</button>}
    {workbook && <section className="project-section"><h2>Pekerjaan dari workbook TS</h2><p>{workbook.items.filter(i => i.kind === 'GROUP').length} kelompok dan {workbook.items.filter(i => i.kind === 'ITEM').length} item akan ditambahkan ke proyek ini. Periksa volume dan harga sebelum menerbitkan Rencana Awal.</p>
      <details className="disclosure workbook-source" open><summary>Rincian pekerjaan dan sumber workbook</summary><p>{workbook.note}</p><div className="progress-table" tabIndex={0}><table><thead><tr><th>Kode</th><th>Uraian pekerjaan</th><th>Volume</th><th>Satuan</th><th>Harga satuan (Rp)</th></tr></thead><tbody>{workbook.items.map(i => <tr key={i.code}><td>{i.code}</td><td>{i.name}</td><td>{i.kind === 'ITEM' ? displayDecimal(i.contractVolume, 6) : '—'}{Number(i.originalVolume) !== Number(i.contractVolume) && <small> (sumber: {i.originalVolume})</small>}</td><td>{i.unit}</td><td>{i.kind === 'ITEM' ? displayDecimal(i.unitPrice) : '—'}</td></tr>)}</tbody></table></div></details>
      <div className="inline-actions"><button disabled={busy} onClick={() => setWorkbook(null)}>Batal Impor</button><button className="primary" disabled={busy} onClick={async () => {
        setBusy(true); setError('');
        try { await api(`/api/projects/${projectId}/work-items/workbook`, { method: 'POST', body: JSON.stringify({ sourceHash: workbook.sha256, confirm: true }) }); setWorkbook(null); setEditor(null); setNotice('Pekerjaan dari workbook TS berhasil diimpor.'); await load(); }
        catch (err) { setError(err instanceof Error ? err.message : 'Impor belum berhasil.'); }
        finally { setBusy(false); }
      }}>{busy ? 'Mengimpor…' : 'Impor Pekerjaan TS ke Proyek Ini'}</button></div></section>}
    {project.archivedAt && <Feedback>Proyek diarsipkan; daftar pekerjaan hanya dapat dibaca.</Feedback>}
    {list.frozenAt && <Feedback>Volume, harga, dan susunan pekerjaan sudah ditetapkan. {list.freezeReason}</Feedback>}
    {editor && <WorkEditor key={editor.item?.id ?? editor.kind} project={project} list={list} initial={editor} onCancel={() => setEditor(null)} onSaved={async () => { setEditor(null); setNotice('Pekerjaan berhasil disimpan.'); await load(); }} />}
    <div className="stats-row work-summary"><MetricTile label="Total nilai item" value={<span data-testid="work-total">Rp{displayDecimal(list.totalAmount)}</span>} emphasis /><MetricTile label="Total bobot perhitungan" value={list.totalWeight === null ? 'Belum tersedia' : `${displayDecimal(list.totalWeight)}%`} /><MetricTile label="Jumlah item pekerjaan" value={list.leafCount} /></div>
    {list.warning && <div className="work-warning" role="status">{list.warning}</div>}
    <details className="disclosure"><summary>Penjelasan nilai dan bobot</summary><p className="muted small">Hanya item yang masuk total; kelompok menampilkan agregat turunan. Uang dan bobot ditampilkan dengan dua desimal. Jumlah bobot tampilan item: {displayDecimal(list.displayedWeightTotal)}%. Pembulatan tampilan tidak mengubah perhitungan.</p></details>
    {!!list.items.length && <div className="work-list-filters"><label>Cari pekerjaan<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Kode atau uraian pekerjaan" /></label><label>Kelompok pekerjaan<select value={group} onChange={event => setGroup(event.target.value)}><option value="">Semua kelompok</option>{list.items.filter(item => item.kind === 'GROUP').map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label><button type="button" onClick={() => { setSearch(''); setGroup(''); }}>Bersihkan pencarian</button><p role="status">{filterWorkRows(list.items, search, group).filter(item => item.kind === 'ITEM').length} pekerjaan ditampilkan.</p></div>}
    {!list.items.length ? <EmptyState title="Belum ada pekerjaan"><p>{list.canManage ? 'Tambahkan kelompok dan item pekerjaan proyek ini.' : 'Administrator atau Team Leader belum menambahkan pekerjaan.'}</p></EmptyState> : <div className="responsive-table work-items-table-wrap"><table className="adaptive-table work-items-table"><thead><tr><th>Kode dan uraian pekerjaan</th><th>Volume</th><th>Satuan</th><th>Harga satuan</th><th>Jumlah harga</th><th>Bobot</th><th>Tindakan</th></tr></thead><tbody>{filterWorkRows(list.items, search, group).map(item => <tr key={item.id} className={item.kind === 'GROUP' ? 'work-group-row' : ''} aria-label={`${item.code} ${item.name}`}>
      <td data-label="Pekerjaan"><div className={`work-table-name depth-${Math.min(item.depth,4)}`}><span className="work-kind">{item.kind === 'GROUP' ? 'Kelompok' : item.status === 'ACTIVE' ? 'Pekerjaan' : 'Nonaktif'}</span><strong>{item.code} · {item.name}</strong>{item.description && <details><summary>Keterangan</summary><p className="muted small">{item.description}</p></details>}{item.startDate && <small>Jadwal: {item.startDate} — {item.endDate}</small>}{item.notes && <details><summary>Catatan dan asal data</summary><p className="muted small">{item.notes}</p></details>}</div></td>
      <td data-label="Volume">{item.kind === 'ITEM' ? displayDecimal(item.contractVolume, 6).replace(/0+$/, '').replace(/,$/, '') : '—'}</td><td data-label="Satuan">{item.kind === 'ITEM' ? item.unit : '—'}</td><td data-label="Harga satuan">{item.kind === 'ITEM' ? `Rp${displayDecimal(item.unitPrice)}` : '—'}</td><td data-label={item.kind === 'GROUP' ? 'Nilai agregat' : 'Jumlah harga'} title={`Nilai presisi: ${item.amount}`}>Rp{displayDecimal(item.amount)}</td><td data-label="Bobot">{item.displayWeight === null ? 'Belum tersedia' : `${displayDecimal(item.displayWeight)}%`}</td>
      <td data-label="Tindakan"><div className="table-actions">{item.kind === 'ITEM' && <a href={`/proyek/${projectId}/dokumentasi/${item.id}`} aria-label={`Dokumentasi ${item.code}`}>Foto</a>}{list.canManage && <><button disabled={busy} aria-label={`Ubah ${item.code}`} onClick={() => { setEditor({ item, kind: item.kind }); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Ubah</button>{!list.frozenAt && <button disabled={busy} aria-label={`Hapus ${item.code}`} onClick={async () => {
          if (!(await confirm({ title: `Hapus ${item.code} · ${item.name}?`, message: 'Kelompok berturunan dan pekerjaan yang sudah dirujuk tidak dapat dihapus.', confirmLabel: 'Hapus pekerjaan', danger: true }))) return;
          setBusy(true); setError('');
          try { await api(`/api/projects/${projectId}/work-items/${item.id}`, { method: 'DELETE', body: JSON.stringify({ confirm: true }) }); setEditor(null); setNotice('Pekerjaan berhasil dihapus.'); await load(); }
          catch (err) { setError(err instanceof Error ? err.message : 'Pekerjaan belum dapat dihapus.'); }
          finally { setBusy(false); }
        }} className="danger-outline">Hapus</button>}</>}</div></td>
    </tr>)}</tbody></table></div>}{confirmation}
  </>;
}
