import { readFileSync } from 'node:fs';
import type { ExportDocument, ExportCell } from '../../shared/exports.js';
import type { PrintPage } from '../../shared/print-layout.js';
import { decimal,scaled,displayDecimal } from '../../shared/work-items.js';

const templates=JSON.parse(readFileSync(new URL('../templates/workbook-layout.json',import.meta.url),'utf8')).layouts as Record<string,PrintPage>;
export const columnName=(n:number):string=>n>26?columnName(Math.floor((n-1)/26))+String.fromCharCode(65+(n-1)%26):String.fromCharCode(64+n);
export function coordinate(address:string){const [,letters,row]=/^([A-Z]+)(\d+)$/.exec(address)!;return {col:[...letters].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),row:Number(row)};}
const fmt=(v:ExportCell)=>v===null?'':typeof v==='number'?v.toLocaleString('id-ID'):String(v);
const difference=(a:string|null|undefined,b:string|null|undefined)=>{if(a===null||a===undefined||b===null||b===undefined)return null;const n=scaled(a,6)-scaled(b,6);return (n<0n?'-':'')+decimal(n<0n?-n:n,6);};
function put(p:PrintPage,address:string,value:ExportCell,numeric=false,percent=false){
  let cell=p.cells.find(c=>c.address===address);if(!cell){cell={address,value:null,style:{}};p.cells.push(cell);}
  cell.value=numeric&&value!==null?Number(value)/(percent?100:1):value;
  cell.display=numeric&&value!==null?`${String(value).startsWith('-')?'-':''}${displayDecimal(String(value).replace(/^-/,'') ,2)}${percent?'%':''}`:fmt(value);
  if(numeric)cell.style.numFmt=percent?'0.00%':'#,##0.00';
  if(numeric&&!percent&&typeof value==='number'&&Number.isInteger(value)){cell.display=value.toLocaleString('id-ID');cell.style.numFmt='0';}
  if(p.merges.some(m=>m.startsWith(`${address}:`)))cell.style.alignment={...cell.style.alignment,wrapText:true};
}
function merge(p:PrintPage,range:string){const [a,b]=range.split(':').map(coordinate);p.merges=p.merges.filter(m=>{const [x,y]=m.split(':').map(coordinate);return y.row<a.row||x.row>b.row||y.col<a.col||x.col>b.col;});p.merges.push(range);}

export function workbookLayout(doc:ExportDocument):PrintPage[]{
  const meta=Object.fromEntries(doc.metadata),rows=(title:string)=>doc.tables.find(t=>t.title===title)?.rows??[];
  const make=(source:string,name:string)=>({...structuredClone(templates[source]),name});
  const period=meta['Nomor periode']??'1';
  const from=meta['Awal periode']??meta['Tanggal / cut-off']??'',cutoff=meta['Cut-off inklusif']??meta['Tanggal / cut-off']??'';
  const pages:PrintPage[]=[];
  if(['WEEKLY','MONTHLY','PROGRESS'].includes(doc.kind)){
    const basis=rows('Basis pekerjaan'),progress=rows('Progress pekerjaan'),total=rows('Total proyek');
    const source=doc.kind==='MONTHLY'?'B1':'M1',prefix=doc.kind==='MONTHLY'?`B${period}`:doc.kind==='WEEKLY'?`M${period}`:'Progress';
    for(let offset=0;offset<Math.max(1,basis.length);offset+=46){
      const p=make(source,`${prefix}-${offset/46+1}`);pages.push(p);
      for(const range of ['G3:H3','G4:H4','G5:H5','J2:R2','J3:R3','J4:R4','J5:R5','C67:J67','C68:J68','C69:J69','C70:J70','O71:R71','Q72:S72','Q73:S73','Q74:S74','Q75:S75'])merge(p,range);
      merge(p,'U5:W7');merge(p,'U82:W84');
      for(const [a,v] of Object.entries({F2:meta['Nama instansi']??meta['Pemberi pekerjaan'],F5:meta['Pemberi pekerjaan'],F7:meta['Alamat instansi']??'',G2:'Konsultan Supervisi',J2:meta.Konsultan,J3:meta['Nomor kontrak'],J4:meta['Tanggal kontrak'],J5:meta['Nilai kontrak awal (Rp)'],U2:'Kontraktor Pelaksana',U5:meta['Nama kontraktor'],U81:'Kontraktor Pelaksana',U82:meta['Nama kontraktor'],B9:doc.title.toUpperCase(),B10:meta.Kegiatan,B11:meta.Proyek,B12:meta.Lokasi,L12:from,N12:cutoff,P12:doc.kind==='MONTHLY'?period:meta['Bulan ke-']??'',Q12:doc.kind==='WEEKLY'?period:'',R12:meta['Hari ke-']??'',S12:meta['Durasi pelaksanaan']??'',T12:meta['Sisa hari']??'',V12:prefix,T78:meta.Lokasi,U78:cutoff,P82:doc.kind==='MONTHLY'?'':meta.Konsultan,M82:doc.kind==='MONTHLY'?meta.Konsultan:'',E82:doc.kind==='MONTHLY'?'':meta['Nama instansi']??'',J82:doc.kind==='MONTHLY'?'':meta['Nama instansi']??'',F82:doc.kind==='MONTHLY'?meta['Nama instansi']??'':'',B13:`${meta['Versi target']??''} | ${offset/46+1}/${Math.max(1,Math.ceil(basis.length/46))}`,G13:'Pengesahan diisi pihak berwenang'}))put(p,a,v??'');
      let amount=0n,actualAmount=0n;
      for(const item of basis)if(item[3]!==null){amount+=scaled(String(item[5]),8);const c=progress.find(r=>r[0]===item[0]&&r[1]==='Kumulatif');if(c?.[2]!==null&&c?.[2]!==undefined)actualAmount+=scaled(String(item[4]),2)*scaled(String(c[2]),6);}
      basis.slice(offset,offset+46).forEach((item,i)=>{
        const r=i+19;merge(p,`C${r}:F${r}`);merge(p,`I${r}:J${r}`);
        const parts=['Sebelumnya','Periode ini','Kumulatif'].map(part=>progress.find(v=>v[0]===item[0]&&v[1]===part));
        for(const [c,v] of [['B',item[0]],['C',item[1]],['G',item[2]],['V',item[7]]] as const)put(p,`${c}${r}`,v);
        for(const [c,v] of [['H',item[3]],['I',item[4]],['K',item[5]],['L',item[6]],['M',parts[0]?.[2]??null],['N',parts[0]?.[4]??null],['O',parts[1]?.[2]??null],['P',parts[1]?.[4]??null],['Q',parts[2]?.[2]??null],['R',parts[2]?.[4]??null]] as const)put(p,`${c}${r}`,v,true);
        const quantity=parts[2]?.[2];put(p,`S${r}`,item[4]!==null&&quantity!==null&&quantity!==undefined?decimal(scaled(String(item[4]),2)*scaled(String(quantity),6),8):null,true);
        put(p,`T${r}`,parts[2]?.[3]??null,true,true);put(p,`U${r}`,parts[2]?.[4]??null,true,true);
      });
      const contract=(meta['Nilai kontrak awal (Rp)']??'0').replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.');
      put(p,'J5',contract,true);put(p,'K67',decimal(amount,8),true);put(p,'L67',amount>0n?'100':'0',true);put(p,'K68',null);put(p,'C68','PPN (belum dikonfigurasi)');put(p,'C69','TOTAL KONTRAK (APLIKASI)');put(p,'K69',contract,true);put(p,'K70',null);
      put(p,'S67',decimal(actualAmount,8),true);put(p,'S71',decimal(actualAmount,8),true);
      for(const [a,v] of [['N67',total[0]?.[1]],['P67',total[1]?.[1]],['R67',total[2]?.[1]],['U72',total[1]?.[1]]] as const)put(p,a,v??null,true);
      for(const [a,v] of [['U11',total[2]?.[1]],['U67',total[2]?.[1]],['U73',total[2]?.[1]],['U74',total[2]?.[2]],['U75',total[2]?.[3]]] as const)put(p,a,v??null,true,true);
      put(p,'B91','PPN/pembulatan belum dikonfigurasi. Total kontrak dari aplikasi; rincian lengkap pada lampiran.');merge(p,'B91:V91');
    }
  }else if(doc.kind==='CURVE'){
    const chart=doc.chart!;
    for(let offset=0;offset<Math.max(1,chart.labels.length);offset+=22){
      const p=make('TS',`TS-${offset/22+1}`);pages.push(p);p.chart=true;
      for(const [a,v] of Object.entries({B2:doc.title.toUpperCase(),D4:meta.Kegiatan,D5:meta.Proyek,D6:meta.Lokasi,D7:meta['Tahun anggaran']??'',Z4:meta['Durasi pelaksanaan']??'',Z5:from,Z6:cutoff,E9:'%',C9:'RENCANA DAN AKTUAL',D63:'RENCANA AWAL KUMULATIF',D64:'RENCANA PEMBANDING KUMULATIF',D65:'AKTUAL KUMULATIF',D66:'AKTUAL (SETELAH CUT-OFF KOSONG)',D67:'SELISIH AKTUAL - PEMBANDING',D72:meta['Nama instansi']??'',J72:meta['Nama instansi']??'',S72:meta.Konsultan,Z72:meta['Nama kontraktor']}))put(p,a,v??'');
      p.merges=p.merges.filter(m=>coordinate(m.split(':')[0]).row!==9||coordinate(m.split(':')[0]).col<6||coordinate(m.split(':')[0]).col>27);
      chart.labels.slice(offset,offset+22).forEach((date,i)=>{const c=columnName(i+6);put(p,`${c}9`,date.slice(0,7));put(p,`${c}10`,offset+i+1);put(p,`${c}11`,date);put(p,`${c}12`,'Cut-off');put(p,`${c}13`,date);chart.series.forEach((s,n)=>put(p,`${c}${63+n}`,s.values[offset+i]??null,true));put(p,`${c}66`,chart.series[2]?.values[offset+i]??null,true);});
      put(p,'D65','REALISASI PER PERIODE');
      chart.labels.slice(offset,offset+22).forEach((_,i)=>{const c=columnName(i+6),at=offset+i,actual=chart.series[2]?.values[at];put(p,`${c}65`,difference(actual,at===0?'0':chart.series[2]?.values[at-1]),true);put(p,`${c}67`,difference(actual,chart.series[1]?.values[at]),true);});
    }
  }else{
    const activities=rows('Kegiatan harian'),workers=rows('Rincian tenaga kerja'),materials=rows('Rincian material dan alat'),problems=rows('Masalah lapangan'),weather=rows('Cuaca');
    const accepted=materials.filter(r=>r[3]==='Diterima'),rejected=materials.filter(r=>r[3]==='Ditolak');
    const count=Math.max(1,Math.ceil(activities.length/7),Math.ceil(accepted.length/6),Math.ceil(rejected.length/6),Math.ceil(problems.length/2),doc.kind==='WORKFORCE'?Math.ceil(rows('Rekap tenaga kerja').length/6):1);
    for(let page=0;page<count;page++){
      const p=make('H0',`${doc.kind==='DAILY'?'H':'Rekap'}-${page+1}`);pages.push(p);
      for(const range of ['B6:I7','D8:K8','D9:K9','D10:K10','B58:P59'])merge(p,range);
      for(const [a,v] of Object.entries({J2:doc.title.toUpperCase(),L2:meta.Proyek,B6:`Nomor: ${meta['Nomor laporan']??doc.kind} | Kontraktor: ${meta['Nama kontraktor']||'Belum diisi'}`,D8:meta['Nomor kontrak'],D9:meta['Tanggal kontrak'],D10:`${meta['Durasi pelaksanaan']??''} hari`,L10:doc.kind==='DAILY'?cutoff:`${from} s/d ${cutoff}`,N10:meta['Minggu ke-']??'',O10:meta['Hari ke-']??'',P10:meta['Sisa hari']??'',O50:meta.Konsultan,O56:meta.Pembuat??'',B58:`Catatan: ${meta.Status??'Rekap sumber sah'} | ${page+1}/${count}. Rincian lengkap pada lampiran.`}))put(p,a,v??'');
      const positions=['Manajemen Proyek','Manager Lapangan','Staff Administrasi','Drafter','Surveyor','Operator','Pelaksana','Mandor','Tukang','Pekerja','Flagman'];
      const workerRows=[15,16,17,18,22,23,24,25,26,27,28];
      positions.forEach((name,i)=>put(p,`G${workerRows[i]}`,workers.filter(w=>w[4]===name).reduce((n,w)=>n+Number(w[5]),0),true));
      put(p,'G19',workers.filter(w=>w[3]==='Manajemen').reduce((n,w)=>n+Number(w[5]),0),true);put(p,'F34',workers.reduce((n,w)=>n+Number(w[5]),0),true);
      if(doc.kind==='WORKFORCE'){put(p,'G12','Orang-hari');put(p,'B34','Jumlah orang-hari');put(p,'J15','Orang-jam per jabatan:');rows('Rekap tenaga kerja').slice(page*6,page*6+6).forEach((r,i)=>{merge(p,`J${17+i*2}:P${18+i*2}`);put(p,`J${17+i*2}`,`${r[1]}: ${r[3]} orang-jam`);});}
      activities.slice(page*7,page*7+7).forEach((a,i)=>{const r=15+i*2;merge(p,`J${r}:P${r+1}`);put(p,`H${r}`,page*7+i+1);put(p,`J${r}`,`${a[0]??''} ${a[2]} | ${a[3]} | ${a[4]??'Tanpa volume'} ${a[5]??''}`);});
      for(const [i,periodName] of ['PAGI','SIANG','SORE','MALAM'].entries()){const w=weather.find(r=>r[0]===periodName);if(w){const c=w[1]==='BAIK'?'J':w[1]==='GERIMIS'?'K':'N';if(c==='J'){put(p,`${c}${31+i}`,'Ya');}else put(p,`${c}${31+i}`,`${w[2]}–${w[3]}`);}}
      for(const [list,left,right] of [[accepted,'B','G'],[rejected,'J','N']] as const)list.slice(page*6,page*6+6).forEach((m,i)=>{const r=36+i;merge(p,`${left}${r}:${left==='B'?'F':'M'}${r}`);merge(p,`${right}${r}:${right==='G'?'I':'P'}${r}`);put(p,`${left}${r}`,`${m[4]}${m[7]?` (${m[7]})`:''}`);put(p,`${right}${r}`,`${m[5]} ${m[6]}`);});
      problems.slice(page*2,page*2+2).forEach((v,i)=>{const r=43+i*2;merge(p,`B${r}:I${r+1}`);merge(p,`J${r}:P${r+1}`);put(p,`B${r}`,`${v[3]}: ${v[4]} (${v[7]})`);put(p,`J${r}`,String(v[6]));});
    }
  }
  return pages;
}
