import ExcelJS from 'exceljs';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const source = 'LAPORAN PROYEK contoh.xlsx';
const bytes = await readFile(source);
const work = JSON.parse(await readFile('server/templates/workbook-work.json', 'utf8'));
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== work.sha256) throw new Error('Workbook tidak cocok dengan template pekerjaan.');
const book = new ExcelJS.Workbook();
await book.xlsx.load(bytes);
const sheet = book.getWorksheet('TS');
const value = cell => typeof cell.value === 'number' ? cell.value : typeof cell.value?.result === 'number' ? cell.value.result : 0;
const weeks = Array.from({ length: 22 }, (_, index) => {
  const label = sheet.getRow(10).getCell(index + 6).text;
  if (label !== `Mg ${index + 1}`) throw new Error(`Judul ${label} tidak sesuai Minggu ${index + 1}.`);
  return index + 1;
});
const items = work.items.filter(item => item.kind === 'ITEM').map(item => {
  const row = Number(item.source.match(/\d+$/)?.[0]);
  const weight = value(sheet.getCell(`E${row}`));
  const allocations = weeks.map((_, index) => value(sheet.getRow(row).getCell(index + 6)));
  if (weight <= 0 || Math.abs(allocations.reduce((sum, part) => sum + part, 0) - weight) > 1e-8) {
    throw new Error(`Target ${item.code} tidak berjumlah sesuai bobot workbook.`);
  }
  const active = allocations.map((part, index) => part > 0 ? index : -1).filter(index => index >= 0);
  if (!active.length) throw new Error(`Target ${item.code} kosong.`);
  const targets = allocations.map(part => Math.round(part / weight * 100000000));
  const last = active.at(-1);
  targets[last] += 100000000 - targets.reduce((sum, part) => sum + part, 0);
  if (targets.some(part => part < 0 || part > 100000000)) throw new Error(`Target ${item.code} tidak valid.`);
  return { code: item.code, name: item.name, unit: item.unit, contractVolume: item.contractVolume,
    unitPrice: item.unitPrice, targets: targets.map(part => (part / 1000000).toFixed(6)) };
});
await writeFile('server/templates/workbook-targets.json', JSON.stringify({ source, sha256: hash, weeks: weeks.length, items }, null, 2) + '\n');
console.log(`${items.length} target pekerjaan dari TS, ${weeks.length} minggu.`);
