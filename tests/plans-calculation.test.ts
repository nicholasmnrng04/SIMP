import assert from 'node:assert/strict';
import { test } from 'node:test';
import { periods, position, type PlanInput } from '../shared/plans.js';
import { workItemDefaults } from '../shared/work-items.js';
import { calculatePlan } from '../server/services/plan-calculation.js';

test('periode mengikuti 16 Juli, hari terakhir parsial, cutoff dan sisa hari inklusif', () => {
  assert.deepEqual(periods('2026-07-16', '2026-07-23', 'WEEKLY'), [
    { number: 1, start: '2026-07-16', end: '2026-07-22', days: 7 }, { number: 2, start: '2026-07-23', end: '2026-07-23', days: 1 },
  ]);
  assert.deepEqual(position('2026-07-16', '2026-07-23', '2026-07-23'), { day: 8, week: 2, month: 1, remainingDays: 0, durationDays: 8 });
  assert.equal(position('2026-07-16', '2026-07-23', '2026-07-15').day, null);
  assert.equal(position('2026-07-16', '2026-07-23', '2026-07-24').remainingDays, 0);
  assert.deepEqual(periods('2026-07-16', '2026-08-16', 'MONTHLY'), [
    { number: 1, start: '2026-07-16', end: '2026-08-15', days: 31 }, { number: 2, start: '2026-08-16', end: '2026-08-16', days: 1 },
  ]);
});
test('versi baru mengikuti Senin-Minggu tanpa mengubah minggu versi lama', () => {
  const monday = periods('2026-07-16', '2026-12-12', 'WEEKLY', 'MONDAY_SUNDAY');
  assert.equal(monday.length, 22);
  assert.deepEqual(monday[0], { number: 1, start: '2026-07-16', end: '2026-07-19', days: 4 });
  assert.deepEqual(monday.at(-1), { number: 22, start: '2026-12-07', end: '2026-12-12', days: 6 });
  assert.deepEqual(periods('2026-07-20', '2026-07-27', 'WEEKLY', 'MONDAY_SUNDAY'), [
    { number: 1, start: '2026-07-20', end: '2026-07-26', days: 7 },
    { number: 2, start: '2026-07-27', end: '2026-07-27', days: 1 },
  ]);
  assert.equal(position('2026-07-16', '2026-07-23', '2026-07-20', 'MONDAY_SUNDAY').week, 2);
  assert.equal(position('2026-07-16', '2026-07-23', '2026-07-20', 'PROJECT_START').week, 1);
});
test('bulan proyek clamp dari tanggal asli, lintas kabisat/tahun tanpa pergeseran setelah Februari', () => {
  assert.deepEqual(periods('2024-01-31', '2024-04-01', 'MONTHLY').map(p => [p.start, p.end, p.days]), [
    ['2024-01-31', '2024-02-28', 29], ['2024-02-29', '2024-03-30', 31], ['2024-03-31', '2024-04-01', 2],
  ]);
  assert.deepEqual(periods('2025-12-31', '2026-03-01', 'MONTHLY').map(p => p.start), ['2025-12-31', '2026-01-31', '2026-02-28']);
  assert.equal(periods('2024-02-29', '2024-02-29', 'WEEKLY')[0].days, 1);
  assert.throws(() => periods('2026-02-29', '2026-03-01', 'WEEKLY'));
  assert.throws(() => periods('2026-01-02', '2026-01-01', 'WEEKLY'));
  assert.throws(() => periods('2020-01-01', '2040-01-01', 'WEEKLY'));
});
const basis = [
  { ...workItemDefaults, id: 'a', code: 'A', name: 'A', unit: 'm', contractVolume: '1000', unitPrice: '1' },
  { ...workItemDefaults, id: 'b', code: 'B', name: 'B', unit: 'm', contractVolume: '3000', unitPrice: '1' },
];
test('mingguan dan bulanan diturunkan dari alokasi harian tepat serta bobot asli', () => {
  const plan = { startDate: '2026-07-16', endDate: '2026-08-19', granularity: 'WEEKLY' as const, items: [
    { workItemId: 'a', targets: ['20','20','20','20','20'] }, { workItemId: 'b', targets: ['0','0','0','0','100'] },
  ] };
  const weekly = calculatePlan(plan, basis, 'WEEKLY'), monthly = calculatePlan(plan, basis, 'MONTHLY');
  assert.deepEqual(weekly.periods.map(p => p.weighted), ['5.000000','5.000000','5.000000','5.000000','80.000000']);
  // Month 1 contains 4 weeks + 3/7 of week 5: 20 + 80*3/7 = 54.285714...
  assert.equal(monthly.periods[0].weighted, '54.285714');
  assert.equal(monthly.periods[1].weighted, '45.714286');
  assert.equal(monthly.periods[1].cumulative, '100.000000');
  assert.equal(weekly.items[0].quantities[0], '200.000000');
  assert.equal(monthly.items[0].targets[0], '88.571429');
});
test('sumber bulanan dibagi lintas minggu tanpa rounding drift dan volume nol tetap nol', () => {
  const plan: Pick<PlanInput, 'startDate' | 'endDate' | 'granularity' | 'items'> = { startDate: '2026-07-16', endDate: '2026-08-15', granularity: 'MONTHLY', items: [{ workItemId: 'a', targets: ['100'] }, { workItemId: 'b', targets: ['100'] }] };
  const result = calculatePlan(plan, [{ ...basis[0], contractVolume: '0' }, basis[1]], 'WEEKLY');
  assert.equal(result.periods[0].weighted, '22.580645');
  assert.equal(result.periods[4].weighted, '9.677419');
  assert.equal(result.periods[4].cumulative, '100.000000');
  assert.ok(result.items[0].quantities.every(q => q === '0.000000'));
  assert.throws(() => calculatePlan(plan, basis.map(item => ({ ...item, unitPrice: '0' })), 'WEEKLY'), /positif/);
});
