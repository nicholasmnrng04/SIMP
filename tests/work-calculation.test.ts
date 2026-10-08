import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateWorkItems } from '../server/services/work-calculation.js';
import { workItemDefaults, workItemSchema, displayDecimal, type WorkItemRecord } from '../shared/work-items.js';

const item = (id: string, input: Partial<WorkItemRecord> = {}): WorkItemRecord => ({ ...workItemDefaults, id, code: id, name: id, unit: 'm³', contractVolume: '1', unitPrice: '100', ...input });
const group = (id: string, parentId: string | null = null) => item(id, { kind: 'GROUP', parentId, contractVolume: '0', unitPrice: '0', unit: '' });

test('nilai contoh PRD dihitung tepat tanpa floating point', () => {
  const result = calculateWorkItems([item('galian', { contractVolume: '1130', unitPrice: '82504.02' })]);
  assert.equal(result.totalAmount, '93229542.60000000');
  assert.equal(result.items[0].weight, '100.000000');
  assert.equal(displayDecimal(result.totalAmount), '93.229.542,60');
});
test('struktur bertingkat hanya menjumlah item; kelompok menampilkan agregat tanpa hitung ganda', () => {
  const result = calculateWorkItems([group('I'), group('I.1', 'I'), item('A', { parentId: 'I.1', contractVolume: '10', unitPrice: '100' }), item('B', { parentId: 'I', contractVolume: '20', unitPrice: '100' }), item('C', { contractVolume: '70', unitPrice: '100', status: 'INACTIVE' })]);
  assert.equal(result.totalAmount, '10000.00000000'); assert.equal(result.leafCount, 3);
  const byId = new Map(result.items.map((row) => [row.id, row]));
  assert.equal(byId.get('I')!.amount, '3000.00000000'); assert.equal(byId.get('I')!.weight, '30.000000');
  assert.equal(byId.get('I.1')!.weight, '10.000000'); assert.equal(byId.get('A')!.depth, 2);
  assert.equal(byId.get('C')!.weight, '70.000000'); // Status bukan editor basis kontrak.
  assert.equal(result.totalWeight, '100.000000'); assert.equal(result.displayedWeightTotal, '100.00');
});
test('rasio dihitung dari nilai asli; peringatan pembulatan memakai toleransi 0,01 poin', () => {
  const three = calculateWorkItems(['a', 'b', 'c'].map((id) => item(id)));
  assert.equal(three.items[0].weight, '33.333333'); assert.equal(three.items[0].displayWeight, '33.33');
  assert.equal(three.displayedWeightTotal, '99.99'); assert.equal(three.warning, null);
  const six = calculateWorkItems(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => item(id)));
  assert.equal(six.displayedWeightTotal, '100.02'); assert.match(six.warning!, /pembulatan/);
  assert.equal(six.totalWeight, '100.000000');
  assert.equal(displayDecimal('0.00500000'), '0,01'); assert.equal(displayDecimal('0.00499999'), '0,00');
});
test('volume nol, total nol dan kelompok kosong tidak menghasilkan NaN atau Infinity', () => {
  for (const rows of [[], [group('G')], [item('zero', { contractVolume: '0' })], [item('free', { unitPrice: '0' })]]) {
    const result = calculateWorkItems(rows); assert.equal(result.totalAmount, '0.00000000'); assert.equal(result.totalWeight, null);
    assert.match(result.warning!, /masih nol/); assert.equal(JSON.stringify(result).includes('NaN'), false);
  }
  const mixed = calculateWorkItems([item('zero', { contractVolume: '0' }), item('normal')]);
  assert.equal(mixed.items.find((row) => row.id === 'zero')!.weight, '0.000000'); assert.equal(mixed.totalWeight, '100.000000');
});
test('nilai sangat kecil/besar tetap presisi sampai delapan desimal', () => {
  assert.equal(calculateWorkItems([item('tiny', { contractVolume: '0.000001', unitPrice: '0.01' })]).totalAmount, '0.00000001');
  assert.equal(calculateWorkItems([item('large', { contractVolume: '999999999999.999999', unitPrice: '999999999999.99' })]).totalAmount, '999999999999989999000000.00000001');
});
test('siklus, induk hilang, induk item dan identitas ganda ditolak kalkulator', () => {
  for (const rows of [[group('a', 'b'), group('b', 'a')], [item('x', { parentId: 'hilang' })], [item('a'), item('b', { parentId: 'a' })], [item('a'), item('a')]]) assert.throws(() => calculateWorkItems(rows), /Struktur pekerjaan tidak valid/);
});
test('validasi menolak nilai negatif, presisi berlebih, parent ganda dan bobot manual', () => {
  const base = { ...workItemDefaults, code: 'A', name: 'Pekerjaan', unit: 'm³' };
  for (const patch of [{ contractVolume: '-1' }, { unitPrice: '-0.01' }, { contractVolume: '0.0000001' }, { unitPrice: '0.001' }, { unit: '' }, { parentId: ['a', 'b'] }, { weight: '50' }, { startDate: '2026-07-23', endDate: '2026-07-16' }, { startDate: '2026-07-16' }, { kind: 'GROUP', contractVolume: '1' }]) assert.equal(workItemSchema.safeParse({ ...base, ...patch }).success, false);
});
