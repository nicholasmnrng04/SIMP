import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { renderPdf,renderXlsx } from '../server/services/export-files.js';
import type { ExportDocument } from '../shared/exports.js';

test('T10 dokumen kosong dan banyak baris, formula literal, angka eksak, foto dan grafik valid',async()=>{
  const doc:ExportDocument={kind:'CURVE',title:'Pengujian ekspor',projectId:'test',generatedAt:new Date().toISOString(),metadata:[['Proyek','Uji m³']],notes:['Catatan pengujian'],photos:[],tables:[{title:'Kosong',columns:[{label:'Keterangan'}],rows:[]},{title:'Banyak baris',columns:[{label:'Teks pengguna'},{label:'Angka',numeric:true}],rows:[['=HYPERLINK("https://example.test")','9007199254740993.123456'],...Array.from({length:180},(_,i)=>[`Baris ${i}: ${'catatan '.repeat(25)}`,String(i)])]}],chart:{labels:['2026-07-16','2026-07-23'],series:[{name:'Aktual',color:'#006a4e',values:['0','7.5']}]} };
  const png=await sharp({create:{width:40,height:20,channels:3,background:'#397860'}}).png().toBuffer();doc.photos=[{id:'photo',reportId:'r',url:'/private',caption:'Foto uji'}];
  const pdf=await renderPdf(doc,new Map([['photo',png]]));assert.equal(pdf.subarray(0,5).toString(),'%PDF-');const parsed=await PDFDocument.load(pdf);assert.ok(parsed.getPageCount()>5);assert.equal(parsed.getTitle(),doc.title);
  const bytes=await renderXlsx(doc,new Map([['photo',png]]));assert.equal(bytes.subarray(0,2).toString(),'PK');const book=new ExcelJS.Workbook();await book.xlsx.load(bytes as never);const sheet=book.getWorksheet('2 Banyak baris')!;assert.equal(sheet.getCell('A2').type,ExcelJS.ValueType.String);assert.equal(sheet.getCell('A2').value,doc.tables[1].rows[0][0]);assert.equal(sheet.getCell('B3').type,ExcelJS.ValueType.Number);assert.equal(sheet.getCell('B4').value,1);assert.equal(book.getWorksheet('Nilai Eksak')!.getCell('D2').value,'9007199254740993.123456');assert.equal(book.getWorksheet('Grafik')!.getImages().length,1);assert.equal(book.getWorksheet('Foto')!.getImages().length,1);assert.equal(sheet.pageSetup.printTitlesRow,'1:1');assert.ok(sheet.getRow(3).height!>30);assert.ok(Number.isFinite(sheet.getRow(3).height));
});
