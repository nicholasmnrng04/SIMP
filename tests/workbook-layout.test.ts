import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { workbookLayout } from '../server/services/workbook-layout.js';
import { workbookSvg,printRowPages,xml } from '../server/services/workbook-print.js';
import { renderPdf,renderXlsx } from '../server/services/export-files.js';
import type { ExportDocument } from '../shared/exports.js';

test('T11 uraian impor sama dengan semua baris pekerjaan TS sumber', async () => {
  const book = new ExcelJS.Workbook(); await book.xlsx.readFile('LAPORAN PROYEK contoh.xlsx');
  const data = JSON.parse(await readFile('server/templates/workbook-work.json', 'utf8'));
  assert.equal(data.items.length, 45);
  for (let row = 16; row <= 60; row++) {
    const item = data.items.find((i: {source: string}) => i.source === `TS!D${row}`);
    assert.equal(item.name, book.getWorksheet('TS')!.getCell(`D${row}`).text.trim());
  }
});

function fixture():ExportDocument{return {kind:'WEEKLY',title:'Laporan Mingguan',projectId:'synthetic',generatedAt:'2026-10-01T00:00:00.000Z',metadata:[['Proyek','Pembangunan Jalan Uji'],['Kegiatan','Peningkatan akses desa'],['Lokasi','Bandung'],['Nomor kontrak','KONTRAK-2026-001'],['Tanggal kontrak','2026-07-01'],['Nilai kontrak awal (Rp)','Rp1.000.000,00'],['Pemberi pekerjaan','Pemberi Kerja Uji'],['Konsultan','Konsultan Uji'],['Nomor periode','1'],['Awal periode','2026-07-16'],['Cut-off inklusif','2026-07-22'],['Hari ke-','7'],['Sisa hari','23'],['Durasi pelaksanaan','30']],notes:[],photos:[],tables:[{title:'Basis pekerjaan',columns:[],rows:[['A','Galian Tanah','m³','1000','100','100000','100','']]},{title:'Progress pekerjaan',columns:[],rows:[['A','Sebelumnya','0','0','0','0','0','0',null],['A','Periode ini','250','25','25','500','50','50',null],['A','Kumulatif','250','25','25','500','50','50','-25']]},{title:'Total proyek',columns:[],rows:[['Sebelumnya','0','0',null],['Periode ini','25','50',null],['Kumulatif','25','50','-25']]}]};}

test('layout workbook menjaga geometri, sel numerik, pengesahan kosong dan mencegah data contoh bocor',async()=>{
  const reference=new ExcelJS.Workbook();await reference.xlsx.readFile('LAPORAN PROYEK contoh.xlsx');
  const doc=fixture();doc.layout=workbookLayout(doc);const p=doc.layout[0];
  doc.metadata.push(['Nama kontraktor','PT Kontraktor Uji']);doc.layout=workbookLayout(doc);Object.assign(p,doc.layout[0]);
  assert.equal(p.cells.find(c=>c.address==='U5')!.value,'PT Kontraktor Uji');
  assert.equal(p.cells.find(c=>c.address==='U82')!.value,'PT Kontraktor Uji');
  assert.equal(p.source,'M1');assert.equal(p.cols[5],reference.getWorksheet('M1')!.getColumn(6).width);
  assert.equal(p.artwork?.length,2);
  assert.equal(p.heights[8],reference.getWorksheet('M1')!.getRow(9).height);assert.ok(p.merges.includes('C14:F16'));assert.equal(p.setup.printTitlesRow,'14:17');assert.equal(p.setup.paperSize,9);
  assert.equal(p.cells.find(c=>c.address==='U19')!.value,.25);assert.equal(p.cells.find(c=>c.address==='Q19')!.value,250);assert.equal(p.cells.find(c=>c.address==='U75')!.value,-.25);assert.equal(p.cells.find(c=>c.address==='K68')!.value,null);
  assert.doesNotMatch(JSON.stringify(p),/BALIKPAPAN|TENGKONINDO|RAMU PRIMA|SALIH|NOAH BAHTERA|\[1\]Data|sharedFormula/);
  const breaks=printRowPages(p,500,.6);assert.ok(breaks.length>1);assert.deepEqual(breaks[1].slice(0,4),[14,15,16,17]);
  await mkdir('.tmp/workbook-layout',{recursive:true});
  p.svg=workbookSvg(p);await sharp(Buffer.from(p.svg),{density:120}).png().toFile('.tmp/workbook-layout/weekly.png');
  doc.tables=[];const pdf=await renderPdf(doc),xlsx=await renderXlsx(doc);await writeFile('.tmp/workbook-layout/weekly.pdf',pdf);await writeFile('.tmp/workbook-layout/weekly.xlsx',xlsx);
  assert.equal((await PDFDocument.load(pdf)).getPage(0).getWidth(),841.89);
  const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(xlsx as never);const sheet=loaded.worksheets[0];assert.equal(sheet.name,'M1-1');assert.equal(sheet.getCell('Q19').value,250);assert.equal(sheet.getCell('U19').numFmt,'0.00%');assert.equal(sheet.getColumn(6).width,p.cols[5]);
  assert.equal(sheet.getImages().length,2);
  assert.equal(sheet.getCell('U5').value,'PT Kontraktor Uji');
  doc.kind='DAILY';doc.title='Laporan Harian';doc.layout=workbookLayout(doc);await sharp(Buffer.from(workbookSvg(doc.layout[0])),{density:120}).png().toFile('.tmp/workbook-layout/daily.png');assert.equal(doc.layout[0].setup.orientation,'portrait');assert.equal(doc.layout[0].cells.find(c=>c.address==='O56')!.value,'');
  doc.kind='MONTHLY';doc.title='Laporan Bulanan';doc.layout=workbookLayout(doc);await sharp(Buffer.from(workbookSvg(doc.layout[0])),{density:120}).png().toFile('.tmp/workbook-layout/monthly.png');
  assert.equal(doc.layout[0].cells.find(c=>c.address==='M82')!.value,'Konsultan Uji');
  assert.equal(doc.layout[0].cells.find(c=>c.address==='P82')!.value,'');
  assert.equal(xml('<script>\u0001 &'),'&lt;script&gt; &amp;');
  doc.kind='CURVE';doc.chart={labels:['2026-07-15','2026-07-22'],series:[{name:'Awal',color:'#123456',values:['0','50']},{name:'Pembanding',color:'#123456',values:['0','50']},{name:'Aktual',color:'#123456',values:['0','25']}]};doc.layout=workbookLayout(doc);assert.equal(doc.layout[0].cells.find(c=>c.address==='G67')!.value,-25);assert.equal(doc.layout[0].cells.find(c=>c.address==='G65')!.value,25);
});

test('layout lanjutan tidak membuang pekerjaan dan teks pengguna tetap literal',async()=>{
  const doc=fixture();doc.tables[0].rows=Array.from({length:100},(_,i)=>[String(i),'=HYPERLINK("https://example.test")','m','1','2','2','1','']);
  doc.layout=workbookLayout(doc);assert.equal(doc.layout.length,3);assert.equal(doc.layout[2].cells.find(c=>c.address==='B26')!.value,'99');
  const last=doc.layout[2];assert.match(workbookSvg(last),/=HYPERLINK/);doc.tables=[];const book=new ExcelJS.Workbook();await book.xlsx.load(await renderXlsx(doc) as never);assert.equal(book.getWorksheet('M1-3')!.getCell('C19').type,ExcelJS.ValueType.String);assert.equal(book.getWorksheet('M1-3')!.getCell('C19').value,'=HYPERLINK("https://example.test")');
});
