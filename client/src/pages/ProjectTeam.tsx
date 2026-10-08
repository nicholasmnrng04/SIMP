import { useState } from 'react';
import { roleLabels } from '../../../shared/contracts';
import { memberSchema, type MemberInput, type Project, type ProjectMember, type TeamCandidate } from '../../../shared/projects';
import { api, ApiError } from '../api';
import { Feedback, Field, StatusTag, useConfirmAction } from '../components/ui';

export function ProjectTeam({ project, members, reload }: { project: Project; members: ProjectMember[]; reload: () => Promise<void> }) {
  const [editor, setEditor] = useState<{ id: string | null; data: MemberInput } | null>(null);
  const [candidates, setCandidates] = useState<TeamCandidate[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({}), [notice, setNotice] = useState('');
  const { confirm, confirmation } = useConfirmAction();
  async function open(member?: ProjectMember) {
    setBusy(true); setError(''); setNotice(''); setErrors({});
    try {
      const users = (await api<{ users: TeamCandidate[] }>(`/api/projects/${project.id}/candidates`)).users;
      setCandidates(users);
      setEditor({ id: member?.id ?? null, data: member ? { userId: member.userId, role: member.role as MemberInput['role'], startDate: member.startDate, endDate: member.endDate, isActive: member.isActive } : { userId: '', role: 'INSPECTOR', startDate: project.today, endDate: null, isActive: true } });
    } catch (err) { setError(err instanceof Error ? err.message : 'Pilihan pengguna belum dapat dimuat.'); }
    finally { setBusy(false); }
  }
  function update<K extends keyof MemberInput>(key: K, value: MemberInput[K]) {
    setEditor((old) => old ? { ...old, data: { ...old.data, [key]: value } } : old); setErrors((old) => ({ ...old, [key]: '' }));
  }
  const mayEdit = (member: ProjectMember) => project.canManage && (project.canAssignLeadership || ['ENGINEER', 'INSPECTOR'].includes(member.role));
  return <section className="project-section"><div className="section-heading"><div><p className="eyebrow">Penugasan</p><h2>Tim proyek</h2></div>{project.canManage && <button onClick={() => void open()} disabled={busy}>Tambah Anggota</button>}</div>
    <p className="muted small">Akses mengikuti role akun, status aktif, serta tanggal mulai dan selesai penugasan (inklusif) dalam zona {project.timezone}. Administrator menetapkan TL melalui informasi proyek dan dapat mengubah periode penugasannya di sini.</p>
    {error && <Feedback error>{error}</Feedback>}{notice && <Feedback>{notice}</Feedback>}
    {editor && <form className="team-form" noValidate onSubmit={async (event) => {
      event.preventDefault(); if (busy) return;
      const result = memberSchema.safeParse(editor.data);
      if (!result.success) { setErrors(Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]))); return; }
      if (editor.id && !(await confirm({ title: 'Simpan perubahan penugasan?', message: 'Perubahan status atau periode langsung memengaruhi akses pengguna pada proyek ini.', confirmLabel: 'Simpan penugasan', danger: true }))) return;
      setBusy(true); setError('');
      try {
        await api(`/api/projects/${project.id}/team${editor.id ? `/${editor.id}` : ''}`, { method: editor.id ? 'PATCH' : 'POST', body: JSON.stringify(editor.data) });
        setEditor(null); setNotice('Penugasan berhasil disimpan.'); await reload();
      } catch (err) { setError(err instanceof Error ? err.message : 'Penugasan belum dapat disimpan.'); if (err instanceof ApiError) setErrors(err.fields); }
      finally { setBusy(false); }
    }}><h3>{editor.id ? 'Ubah Penugasan' : 'Penugasan Baru'}</h3><div className="form-grid">
      <Field id="member-user" label="Pengguna" error={errors.userId}><select id="member-user" value={editor.data.userId} disabled={busy || !!editor.id} onChange={(event) => { const candidate = candidates.find((value) => value.id === event.target.value); if (candidate) setEditor({ ...editor, data: { ...editor.data, userId: candidate.id, role: candidate.role as MemberInput['role'] } }); else update('userId', ''); }}><option value="">Pilih pengguna</option>{editor.id && !candidates.some((candidate) => candidate.id === editor.data.userId) && <option value={editor.data.userId}>{members.find((member) => member.id === editor.id)?.name} (penugasan saat ini)</option>}{candidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.name} — {roleLabels[candidate.role]}</option>)}</select></Field>
      <Field id="member-role" label="Peran dalam proyek"><input id="member-role" readOnly value={roleLabels[editor.data.role]} /></Field>
      <Field id="member-start" label="Mulai penugasan" error={errors.startDate}><input id="member-start" type="date" value={editor.data.startDate} disabled={busy} onChange={(event) => update('startDate', event.target.value)} /></Field>
      <Field id="member-end" label="Selesai penugasan (opsional)" hint="Kosong berarti tanpa batas tanggal akhir." error={errors.endDate}><input id="member-end" type="date" value={editor.data.endDate ?? ''} disabled={busy} onChange={(event) => update('endDate', event.target.value || null)} /></Field>
    </div><label className="checkbox-label"><input type="checkbox" checked={editor.data.isActive} disabled={busy} onChange={(event) => update('isActive', event.target.checked)} />Penugasan aktif</label><p className="muted small">Untuk menghapus akses, nonaktifkan penugasan. Riwayat tetap tersimpan.</p><div className="form-actions"><button className="primary" disabled={busy} type="submit">{busy ? 'Menyimpan…' : 'Simpan Penugasan'}</button><button type="button" disabled={busy} onClick={() => setEditor(null)}>Batal</button></div></form>}
    {!members.length ? <div className="state-panel">Belum ada anggota tim. Administrator atau TL dapat menambahkan penugasan.</div> : <div className="responsive-table"><table className="adaptive-table team-table"><thead><tr><th>Anggota</th><th>Peran</th><th>Periode penugasan</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>{members.map(member => <tr key={member.id}><td data-label="Anggota"><strong>{member.name}</strong>{member.email && <small className="member-email">{member.email}</small>}{(!member.userActive || member.currentRole !== member.role) && <small className="field-error">Akun nonaktif atau peran akun sudah berubah.</small>}</td><td data-label="Peran"><StatusTag tone="info">{roleLabels[member.role]}</StatusTag></td><td data-label="Periode">{member.startDate}<br />sampai {member.endDate ?? 'tanpa batas akhir'}</td><td data-label="Status"><StatusTag tone={member.effective ? 'success' : 'neutral'}>{member.effective ? 'Aktif saat ini' : 'Tidak aktif saat ini'}</StatusTag></td><td data-label="Tindakan">{mayEdit(member) ? <button disabled={busy} onClick={() => void open(member)} aria-label={`Ubah penugasan ${member.name}`}>Ubah</button> : '—'}</td></tr>)}</tbody></table></div>}{confirmation}
  </section>;
}
