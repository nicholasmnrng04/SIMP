import ExcelJS from 'exceljs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const file = 'LAPORAN PROYEK contoh.xlsx';
const bytes = await readFile(file), book = new ExcelJS.Workbook();
await book.xlsx.load(bytes);
const ts = book.getWorksheet('TS'), m1 = book.getWorksheet('M1');
// Resolve only literal numbers and direct local cell references; never use caches.
function number(cell, seen = new Set()) {
  if (seen.has(cell.address)) throw new Error('Referensi berulang');
  seen.add(cell.address);
  if (typeof cell.value === 'number') return cell.value;
  if (cell.formula && /^[A-Z]+[1-9][0-9]*$/.test(cell.formula)) return number(m1.getCell(cell.formula), seen);
  throw new Error(`Angka ${cell.address} bukan angka literal/referensi lokal yang didukung`);
}
const items = []; let group = '', parent = '';
for (let row = 16; row <= 60; row++) {
  const raw = ts.getCell(`B${row}`).value, name = ts.getCell(`D${row}`).text.trim();
  if (!name) continue;
  let code, parentCode, kind;
  if (typeof raw === 'string') {
    kind = 'GROUP';
    if (/^[IVX]+$/.test(raw)) { code = raw; parentCode = null; group = raw; }
    else { code = `${group}.${raw}`; parentCode = group; }
    parent = code;
  } else { kind = 'ITEM'; code = `${parent}.${raw}`; parentCode = parent; }
  const volume = kind === 'ITEM' ? number(m1.getCell(`H${row + 3}`)) : 0;
  const price = kind === 'ITEM' ? number(m1.getCell(`J${row + 3}`)) : 0;
  items.push({ code, parentCode, kind, name, unit: kind === 'ITEM' ? m1.getCell(`G${row + 3}`).text.trim() : '',
    contractVolume: volume.toFixed(6), unitPrice: price.toFixed(2), source: `TS!D${row}`, basisSource: kind === 'ITEM' ? `M1!G${row + 3},H${row + 3},J${row + 3}` : null,
    originalVolume: String(volume) });
}
const result = { source: file, sha256: createHash('sha256').update(bytes).digest('hex'),
  note: 'Uraian/hierarki dari TS; satuan, volume, harga dari M1. Volume dibulatkan ke 6 desimal sesuai kontrak aplikasi. Target, aktual, dan persetujuan tidak diimpor.', items };
await writeFile('server/templates/workbook-work.json', JSON.stringify(result, null, 2) + '\n');
console.log(`${items.length} baris pekerjaan diekstrak dari TS.`);
