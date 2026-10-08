import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateProgress } from '../server/services/progress-calculation.js';
import { workItemDefaults } from '../shared/work-items.js';
import type { PlanInput } from '../shared/plans.js';
import { fraction, add, render } from '../server/services/fractions.js';

const basis = [
  { ...workItemDefaults, id: 'g', kind: 'GROUP' as const, code: 'G', name: 'Grup' },
  { ...workItemDefaults, id: 'a', parentId: 'g', code: 'A', name: 'Galian', unit: 'm3', contractVolume: '1000', unitPrice: '100' },
  { ...workItemDefaults, id: 'b', parentId: 'g', code: 'B', name: 'Pipa', unit: 'm', contractVolume: '9000', unitPrice: '100' },
];
const source = (quantity: string, reportDate = '2026-07-23', activityId = 's') => ({ activityId, workItemId: 'a', quantity, reportDate });
const plan: PlanInput = { previousVersionId: null, basisToken: 'test', name: 'Awal', reason: 'Tes', description: '', startDate: '2026-07-16', endDate: '2026-07-23', effectiveDate: '2026-07-16', granularity: 'WEEKLY', items: [{ workItemId: 'a', targets: ['50', '50'] }, { workItemId: 'b', targets: ['50', '50'] }] };
test('T07 250/1000 bobot 10 = 2,5; partisi tepat dan kelompok tidak menggandakan', () => {
  const result = calculateProgress(basis, [source('100', '2026-07-22', 'old'), source('150')], '2026-07-23', '2026-07-23', plan);
  const item = result.items.find(i => i.id === 'a')!;
  assert.deepEqual(item.actual.cumulative, { quantity: '250.000000', physical: '25.000000', weighted: '2.500000' });
  assert.equal(item.actual.previous.quantity, '100.000000'); assert.equal(item.actual.current.quantity, '150.000000');
  assert.deepEqual(result.total.actual, { previous: '1.000000', current: '1.500000', cumulative: '2.500000' });
  assert.equal(result.items[0].actual.cumulative.quantity, null); assert.equal(result.items[0].actual.cumulative.weighted, '2.500000');
  assert.equal(result.total.deviation, '-97.500000');
  assert.equal(calculateProgress(basis, [source('200')], '2026-07-23', '2026-07-23', plan).total.actual.cumulative, '2.000000');
});
test('T07 cutoff inklusif, revisi rencana hanya mengubah target, bukan aktual', () => {
  const sources = [source('250'), source('100', '2026-07-24', 'later')];
  const before = calculateProgress(basis, sources, '2026-07-23', '2026-07-23', plan);
  const after = calculateProgress(basis, sources, '2026-07-23', '2026-07-23', { ...plan, endDate: '2026-07-29', items: plan.items.map(i => ({ ...i, targets: ['10', '90'] })) });
  assert.deepEqual(before.total.actual, after.total.actual);
  assert.deepEqual(before.items.map(i => i.actual), after.items.map(i => i.actual));
  assert.notDeepEqual(before.total.target, after.total.target);
  assert.equal(calculateProgress(basis, sources, '2026-07-16', '2026-07-22', plan).total.actual.cumulative, '0.000000');
  assert.equal(calculateProgress(basis, sources, '2026-07-24', '2026-07-24', plan).total.actual.cumulative, '3.500000');
});
test('T07 pembagi nol, sumber ganda, batas kontrak dan pembulatan rasional', () => {
  const zero = calculateProgress(basis.map(i => ({ ...i, contractVolume: '0', unitPrice: '0' })), [], '2026-07-16', '2026-07-23', plan);
  assert.equal(zero.total.actual.cumulative, null); assert.equal(zero.items[1].actual.cumulative.physical, null);
  assert.throws(() => calculateProgress(basis, [source('1001')], '2026-07-16', '2026-07-23', plan), /melebihi/);
  assert.throws(() => calculateProgress(basis, [source('1'), source('1')], '2026-07-16', '2026-07-23', plan), /ganda/);
  assert.equal(render(add(fraction(1n, 3n), fraction(2n, 3n))), '1.000000');
  assert.equal(render(fraction(-3n)), '-3.000000');
  assert.equal(calculateProgress(basis, [], '2026-07-16', '2026-07-16', plan).total.target.current, '7.142857');
});

test('T07 deviasi 42 - 45, bulan kabisat dan angka besar mempertahankan presisi', () => {
  const one = [{ ...basis[1], parentId: null, contractVolume: '100' }];
  const monthly = { ...plan, startDate: '2024-02-01', endDate: '2024-02-29', effectiveDate: '2024-02-01', granularity: 'MONTHLY' as const, items: [{ workItemId: 'a', targets: ['100'] }] };
  assert.equal(calculateProgress(one, [], '2024-02-29', '2024-02-29', monthly).total.target.current, '3.448276');
  const target = { ...plan, items: [{ workItemId: 'a', targets: ['45', '55'] }] };
  const result = calculateProgress(one, [source('42', '2026-07-22')], '2026-07-16', '2026-07-22', target);
  assert.equal(result.total.deviation, '-3.000000');
  const huge = [{ ...one[0], contractVolume: '999999999999.999999', unitPrice: '999999999999.99' }];
  const complete = calculateProgress(huge, [source('999999999999.999999')], '2026-07-16', '2026-07-23', null);
  assert.equal(complete.total.actual.cumulative, '100.000000');
  assert.equal(complete.items[0].actual.cumulative.quantity, '999999999999.999999');
});
