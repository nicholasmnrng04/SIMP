import { useState } from 'react';
import { reportStatuses, type Report, type Review } from '../../../shared/reports';
import { api, ApiError } from '../api';
import { Feedback, Field, HistoryTimeline, StatusTag, useConfirmAction } from '../components/ui';

const labels = { TECHNICAL_NOTE:'Catatan Engineer', APPROVE:'Disetujui Team Leader', REQUEST_CHANGES:'Permintaan Perbaikan' };
export function ReportReview({report,reload}:{report:Report;reload:()=>Promise<void>}) {
  const [note,setNote]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const { confirm, confirmation } = useConfirmAction();
  const send=async(kind:Review['kind']|'CORRECTION')=>{
    if(busy)return;
    if((kind==='CORRECTION'?reason:note).trim().length<3&&kind!=='APPROVE'){setError('Isi catatan atau alasan minimal tiga karakter.');return;}
    setBusy(true);setError('');setNotice('');
    try {
      const result=await api<{id:string}>(`/api/projects/${report.projectId}/reports/${report.id}/${kind==='CORRECTION'?'corrections':'reviews'}`,{method:'POST',body:JSON.stringify(kind==='CORRECTION'?{editVersion:report.editVersion,reason}:{editVersion:report.editVersion,kind,note})});
      if(kind==='CORRECTION'){window.location.assign(`/proyek/${report.projectId}/laporan/${result.id}`);return;}
      await reload();setNote('');setNotice(kind==='TECHNICAL_NOTE'?'Catatan pemeriksaan tersimpan.':kind==='APPROVE'?'Laporan berhasil disetujui.':'Permintaan perbaikan tersimpan.');
    }catch(err){setError(err instanceof ApiError?err.message:'Tindakan belum berhasil. Coba lagi.');}finally{setBusy(false);}
  };
  return <section className="project-section report-review"><div className="section-heading"><div><h2>{report.canReview||report.canNote?'Pemeriksaan laporan':'Status pemeriksaan'}</h2><p className="muted">Versi {report.revision} · {report.isAuthoritative?'Digunakan dalam perhitungan kemajuan':report.status==='APPROVED'?'Arsip versi disetujui, telah digantikan':'Belum dihitung dalam kemajuan'}</p></div><StatusTag tone={report.isAuthoritative?'success':report.status==='NEEDS_REVISION'?'danger':report.status==='SUBMITTED'?'warning':'neutral'}>{report.isAuthoritative?'Digunakan dalam kemajuan':report.status==='APPROVED'?'Versi lama':'Belum dihitung'}</StatusTag></div>
    {report.correctionReason&&<p>Alasan koreksi: {report.correctionReason}</p>}
    {error&&<Feedback error>{error}</Feedback>}{notice&&<Feedback>{notice}</Feedback>}

    {report.reviews.slice(-1).map(review=><article className="report-row" key={review.id}><h3>{labels[review.kind]}</h3><p>{review.actorName} · {new Date(review.createdAt).toLocaleString('id-ID')}</p><p>{review.note||'Disetujui tanpa catatan tambahan.'}</p></article>)}
    {(report.canReview||report.canNote)&&<fieldset disabled={busy}><Field id="review-note" label={report.canNote?'Catatan pemeriksaan teknis':'Catatan keputusan (wajib untuk perbaikan)'}><textarea id="review-note" value={note} maxLength={5000} onChange={e=>setNote(e.target.value)} /></Field><div className="form-actions">
      {report.canNote?<button type="button" className="primary" onClick={()=>void send('TECHNICAL_NOTE')}>Simpan Catatan Engineer</button>:<><button type="button" className="primary" onClick={async()=>{if(await confirm({title:'Setujui laporan?',message:'Kegiatan dalam laporan ini akan diperhitungkan dalam kemajuan proyek.',confirmLabel:'Setujui laporan'}))void send('APPROVE');}}>Setujui Laporan</button><button type="button" className="warning-outline" onClick={()=>void send('REQUEST_CHANGES')}>Minta Perbaikan</button></>}
    </div></fieldset>}
    {report.canCorrect&&<details className="disclosure"><summary>Koreksi laporan disetujui</summary><fieldset disabled={busy}><h3>Koreksi laporan disetujui</h3><p>Koreksi membuat versi baru beserta salinan foto. Versi ini tetap berlaku sampai koreksi disetujui.</p><Field id="correction-reason" label="Alasan koreksi"><textarea id="correction-reason" value={reason} maxLength={2000} onChange={e=>setReason(e.target.value)} /></Field><button onClick={()=>void send('CORRECTION')}>Buat Koreksi</button></fieldset></details>}
    <details className="disclosure"><summary>Riwayat pemeriksaan dan versi</summary><HistoryTimeline>{report.reviews.slice(0,-1).map(review=><article className="history-event" key={review.id}><h3>{labels[review.kind]}</h3><p>{review.actorName} · {new Date(review.createdAt).toLocaleString('id-ID')}</p><p>{review.note||'Disetujui tanpa catatan tambahan.'}</p></article>)}</HistoryTimeline><h3>Versi laporan</h3><ul>{report.history.map(version=><li key={version.id}><a href={`/proyek/${report.projectId}/laporan/${version.id}`}>Versi {version.revision}</a> · {reportStatuses[version.status]}{version.isAuthoritative?' · Digunakan dalam perhitungan kemajuan':''}{version.correctionReason?` · ${version.correctionReason}`:''}</li>)}</ul></details>
    {confirmation}
  </section>;
}
