import { useEffect, useState } from 'react';
import type { SessionUser } from '../../../shared/contracts';
import { formatRupiah, projectSchema, type Project, type ProjectInput, type TeamCandidate } from '../../../shared/projects';
import { api, ApiError } from '../api';
import { ActionBar, Feedback, Field, useConfirmAction } from '../components/ui';

const groups: (keyof ProjectInput)[][] = [
  ['projectCode', 'projectName', 'activityName', 'location', 'fiscalYear', 'clientName', 'clientAgency', 'clientAgencyAddress', 'consultantName', 'contractorName', 'teamLeaderId'],
  ['contractNumber', 'contractDate', 'initialContractValue', 'currentContractValue', 'startDate', 'endDate', 'description'],
];
export function ProjectForm({ user, project, onCancel, onSaved }: { user: SessionUser; project?: Project; onCancel: () => void; onSaved: (project: Project) => void }) {
  const [data, setData] = useState<ProjectInput>(project ? Object.fromEntries([...groups[0], ...groups[1]].map((key) => [key, project[key]])) as ProjectInput : {
    projectCode: '', activityName: '', projectName: '', location: '', fiscalYear: null, contractNumber: '', contractDate: null,
    initialContractValue: '0', currentContractValue: '0', startDate: '', endDate: '', clientName: '', clientAgency: '',
    clientAgencyAddress: '', consultantName: '', contractorName: '', teamLeaderId: user.role === 'TEAM_LEADER' ? user.id : null, description: '',
  });
  const [step, setStep] = useState(0), [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [leaders, setLeaders] = useState<TeamCandidate[]>([]);
  const [leaderError, setLeaderError] = useState('');
  const { confirm, confirmation } = useConfirmAction();
  async function loadLeaders() {
    setLeaderError('');
    try { setLeaders((await api<{ users: TeamCandidate[] }>('/api/project-team-leaders')).users); }
    catch (err) { setLeaderError(err instanceof Error ? err.message : 'Team Leader belum dapat dimuat.'); }
  }
  useEffect(() => { if (user.role === 'ADMINISTRATOR') void loadLeaders(); }, [user.role]);
  function update<K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) {
    setData((previous) => ({ ...previous, [key]: value })); setErrors((previous) => ({ ...previous, [key]: '' }));
  }
  function validate(currentStep?: number) {
    const result = projectSchema.safeParse(data), next: Record<string, string> = {};
    if (!result.success) for (const issue of result.error.issues) {
      const key = String(issue.path[0]);
      if (currentStep === undefined || groups[currentStep].includes(key as keyof ProjectInput)) next[key] ??= issue.message;
    }
    setErrors(next);
    if (currentStep === undefined && Object.keys(next).length) setStep(groups[0].some((key) => next[key]) ? 0 : 1);
    return Object.keys(next).length === 0;
  }
  function field(key: keyof ProjectInput, label: string, type = 'text', hint?: string) {
    const id = `project-${key}`;
    return <Field id={id} key={key} label={label} error={errors[key]} hint={hint}>
      <input id={id} type={type} value={data[key] ?? ''} disabled={busy} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `${id}-error` : hint ? `${id}-hint` : undefined}
        step={key === 'fiscalYear' ? '1' : undefined} inputMode={key.includes('ContractValue') ? 'decimal' : undefined}
        onChange={(event) => update(key, key === 'fiscalYear' ? event.target.value ? Number(event.target.value) : null : key === 'contractDate' ? event.target.value || null : key.includes('ContractValue') ? event.target.value.replace(',', '.') : event.target.value)} />
    </Field>;
  }
  const duration = projectSchema.shape.startDate.safeParse(data.startDate).success && projectSchema.shape.endDate.safeParse(data.endDate).success
    ? Math.round((Date.parse(data.endDate) - Date.parse(data.startDate)) / 86400000) + 1 : null;
  return <><section className="editor-card"><div className="section-heading"><div><p className="eyebrow">Data proyek</p><h2>{project ? 'Ubah Proyek' : 'Tambah Proyek'}</h2></div><button type="button" disabled={busy} onClick={onCancel}>Batal</button></div>
    <ol className="form-steps" aria-label="Tahapan form">{['Identitas dan pihak terkait', 'Kontrak dan jadwal', 'Periksa dan simpan'].map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
    {error && <Feedback error>{error}</Feedback>}
    <form noValidate onSubmit={async (event) => {
      event.preventDefault(); if (busy) return;
      if (step < 2) { if (validate(step)) setStep(step + 1); return; }
      if (!validate()) return;
      if (project && project.teamLeaderId !== data.teamLeaderId && !(await confirm({ title: 'Ganti Team Leader?', message: 'Akses Team Leader lama melalui penugasan ini akan berakhir setelah perubahan disimpan.', confirmLabel: 'Ganti Team Leader', danger: true }))) return;
      setBusy(true); setError('');
      try { const result = await api<{ project: Project }>(project ? `/api/projects/${project.id}` : '/api/projects', { method: project ? 'PATCH' : 'POST', body: JSON.stringify(data) }); onSaved(result.project); }
      catch (err) { setError(err instanceof Error ? err.message : 'Proyek belum dapat disimpan.'); if (err instanceof ApiError) { setErrors(err.fields); if (Object.keys(err.fields).length) setStep(groups[0].some((key) => err.fields[key]) ? 0 : 1); } setBusy(false); }
    }}>
      {step === 0 && <div className="form-grid">
        {field('projectCode', 'Kode proyek *')}{field('projectName', 'Nama pekerjaan *')}{field('activityName', 'Nama kegiatan')}{field('location', 'Lokasi')}{field('fiscalYear', 'Tahun anggaran', 'number')}
        {field('clientName', 'Pemberi pekerjaan')}{field('clientAgency', 'Nama instansi')}{field('clientAgencyAddress', 'Alamat instansi')}{field('consultantName', 'Konsultan supervisi')}{field('contractorName', 'Nama kontraktor', 'text', 'Nama perusahaan pelaksana pekerjaan.')}
        <Field id="project-leader" label="Team Leader" hint={user.role === 'ADMINISTRATOR' ? 'Penugasan TL dimulai hari ini agar persiapan proyek dapat dikerjakan.' : 'Anda menjadi TL proyek yang Anda buat.'}>
          {user.role === 'ADMINISTRATOR' ? <><select id="project-leader" value={data.teamLeaderId ?? ''} disabled={busy} onChange={(event) => update('teamLeaderId', event.target.value || null)}><option value="">Belum ditetapkan</option>
            {data.teamLeaderId && !leaders.some((leader) => leader.id === data.teamLeaderId) && <option value={data.teamLeaderId}>{project?.teamLeaderName ?? 'TL saat ini'} (periksa akun)</option>}
            {leaders.map((leader) => <option key={leader.id} value={leader.id}>{leader.name}</option>)}</select>{leaderError && <><Feedback error>{leaderError}</Feedback><button type="button" onClick={() => void loadLeaders()}>Muat Ulang TL</button></>}</> : <input id="project-leader" value={user.name} readOnly />}
        </Field>
      </div>}
      {step === 1 && <><div className="form-grid">
        {field('contractNumber', 'Nomor kontrak')}{field('contractDate', 'Tanggal kontrak', 'date')}
        {field('initialContractValue', 'Nilai kontrak awal (Rp)', 'text', 'Tanpa pemisah ribuan; contoh 1000000,50.')}{field('currentContractValue', 'Nilai kontrak berjalan (Rp)', 'text', 'Nilai berlaku saat ini; tidak mengubah kontrak awal.')}
        {field('startDate', 'Tanggal mulai *', 'date')}{field('endDate', 'Tanggal selesai *', 'date')}
      </div><p className="muted">Durasi pelaksanaan: <strong>{duration && duration > 0 ? `${duration} hari (inklusif)` : 'Lengkapi tanggal yang valid'}</strong></p>
        <Field id="project-description" label="Keterangan" error={errors.description}><textarea id="project-description" rows={4} value={data.description} disabled={busy} onChange={(event) => update('description', event.target.value)} /></Field></>}
      {step === 2 && <div className="project-review"><h3>Periksa sebelum menyimpan</h3><dl className="detail-grid"><div><dt>Kode proyek</dt><dd>{data.projectCode}</dd></div><div><dt>Nama pekerjaan</dt><dd>{data.projectName}</dd></div><div><dt>Jadwal</dt><dd>{data.startDate} sampai {data.endDate} ({duration} hari)</dd></div><div><dt>Kontrak awal / berjalan</dt><dd>{formatRupiah(data.initialContractValue)} / {formatRupiah(data.currentContractValue)}</dd></div></dl><p className="muted">Status awal dihitung dari tanggal. Koreksi status beserta alasan tersedia pada detail proyek.</p></div>}
      <ActionBar sticky>{step > 0 && <button type="button" disabled={busy} onClick={() => setStep(step - 1)}>Sebelumnya</button>}<button className="primary" type="submit" disabled={busy}>{busy ? 'Menyimpan…' : step === 2 ? 'Simpan Proyek' : 'Lanjut'}</button></ActionBar>
    </form>
  </section>{confirmation}</>;
}
