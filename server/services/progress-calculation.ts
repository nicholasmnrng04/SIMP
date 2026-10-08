import type { PlanInput } from '../../shared/plans.js';
import { dateAt, dayIndex } from '../../shared/plans.js';
import { decimal, scaled, type WorkItemRecord } from '../../shared/work-items.js';
import type { Partition, ProgressItem, ProgressValue, ProgressResult } from '../../shared/progress.js';
import { calculateWorkItems } from './work-calculation.js';
import { planTargetsBetween } from './plan-calculation.js';
import { add, fraction, multiply, subtract, render, type Fraction } from './fractions.js';

type Contribution = { activityId: string; workItemId: string; quantity: string; reportDate: string };
type ExactValue = { quantity: Fraction | null; physical: Fraction | null; weighted: Fraction | null };
const keys = ['previous', 'current', 'cumulative'] as const;
const zero = () => fraction(0n);
const empty = (): ExactValue => ({ quantity: null, physical: null, weighted: null });
const partition = <T>(make: () => T): Partition<T> => ({ previous: make(), current: make(), cumulative: make() });
const rendered = (value: ExactValue): ProgressValue => ({ quantity: value.quantity && render(value.quantity), physical: value.physical && render(value.physical), weighted: value.weighted && render(value.weighted) });

export function calculateProgress(basis: WorkItemRecord[], contributions: Contribution[], from: string, cutoff: string, plan: PlanInput | null) {
  const work = calculateWorkItems(basis), totalAmount = scaled(work.totalAmount, 8);
  const rows = new Map(work.items.map(item => [item.id, item]));
  const volumes = new Map<string, Partition<bigint>>(), sourceCounts = new Map<string, number>();
  const seen = new Set<string>();
  for (const source of contributions) {
    if (seen.has(source.activityId)) throw new Error('Sumber kegiatan progress tidak boleh ganda.');
    seen.add(source.activityId);
    const item = rows.get(source.workItemId);
    if (!item || item.kind !== 'ITEM') throw new Error('Sumber progress tidak sesuai basis pekerjaan.');
    if (source.reportDate > cutoff) continue;
    const value = volumes.get(item.id) ?? partition(() => 0n), quantity = scaled(source.quantity, 6);
    value[source.reportDate < from ? 'previous' : 'current'] += quantity; value.cumulative += quantity;
    if (value.cumulative > scaled(item.contractVolume, 6)) throw new Error('Volume kumulatif melebihi kontrak; periksa sumber laporan sah.');
    volumes.set(item.id, value); sourceCounts.set(item.id, (sourceCounts.get(item.id) ?? 0) + 1);
  }
  const targetPrevious = plan ? planTargetsBetween(plan, plan.startDate, dateAt(dayIndex(from) - 1)) : null;
  const targetCurrent = plan ? planTargetsBetween(plan, from, cutoff) : null;
  const exact = new Map<string, { actual: Partition<ExactValue>; target: Partition<ExactValue> }>();
  for (const item of work.items) {
    const actual = partition(empty), target = partition(empty), volume = scaled(item.contractVolume, 6), amount = scaled(item.amount, 8);
    if (item.kind === 'ITEM') {
      const quantities = volumes.get(item.id) ?? partition(() => 0n);
      for (const key of keys) {
        const quantity = quantities[key];
        actual[key] = { quantity: fraction(quantity, 1000000n), physical: volume ? fraction(quantity * 100n, volume) : null,
          weighted: totalAmount ? fraction(quantity * scaled(item.unitPrice, 2) * 100n, totalAmount) : null };
      }
      if (plan) {
        const previous = targetPrevious!.get(item.id) ?? zero(), current = targetCurrent!.get(item.id) ?? zero();
        const percents = { previous, current, cumulative: add(previous, current) };
        for (const key of keys) target[key] = { physical: percents[key], quantity: multiply(percents[key], fraction(volume, 100000000n)), weighted: totalAmount ? multiply(percents[key], fraction(amount, totalAmount)) : null };
      }
    } else {
      for (const key of keys) { actual[key].weighted = totalAmount ? zero() : null; target[key].weighted = totalAmount && plan ? zero() : null; }
    }
    exact.set(item.id, { actual, target });
  }
  // Only weighted values can be aggregated across different units. Groups have no volume/physical percentage.
  for (const item of [...work.items].reverse()) if (item.parentId) {
    const child = exact.get(item.id)!, parent = exact.get(item.parentId)!;
    for (const key of keys) for (const type of ['actual', 'target'] as const) {
      const value = child[type][key].weighted;
      if (value && parent[type][key].weighted) parent[type][key].weighted = add(parent[type][key].weighted!, value);
    }
    sourceCounts.set(item.parentId, (sourceCounts.get(item.parentId) ?? 0) + (sourceCounts.get(item.id) ?? 0));
  }
  const totalActual = partition(zero), totalTarget = partition(zero);
  const items: ProgressItem[] = work.items.map(item => {
    const value = exact.get(item.id)!;
    if (item.kind === 'ITEM') for (const key of keys) {
      if (value.actual[key].weighted) totalActual[key] = add(totalActual[key], value.actual[key].weighted!);
      if (value.target[key].weighted) totalTarget[key] = add(totalTarget[key], value.target[key].weighted!);
    }
    return { ...item, actual: { previous: rendered(value.actual.previous), current: rendered(value.actual.current), cumulative: rendered(value.actual.cumulative) },
      target: { previous: rendered(value.target.previous), current: rendered(value.target.current), cumulative: rendered(value.target.cumulative) },
      deviation: value.actual.cumulative.weighted && value.target.cumulative.weighted ? render(subtract(value.actual.cumulative.weighted, value.target.cumulative.weighted)) : null, sourceCount: sourceCounts.get(item.id) ?? 0 };
  });
  const total: ProgressResult['total'] = { actual: partition(() => null), target: partition(() => null), deviation: null };
  for (const key of keys) { total.actual[key] = totalAmount ? render(totalActual[key]) : null; total.target[key] = totalAmount && plan ? render(totalTarget[key]) : null; }
  if (totalAmount && plan) total.deviation = render(subtract(totalActual.cumulative, totalTarget.cumulative));
  return { items, total, basisTotalAmount: decimal(totalAmount, 8), warning: work.warning };
}
