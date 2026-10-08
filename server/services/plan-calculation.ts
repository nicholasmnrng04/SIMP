import { daysBetween, periods, type PeriodType, type PlanInput, type PlanSeries, type WeekConvention } from '../../shared/plans.js';
import { scaled, type WorkItemRecord } from '../../shared/work-items.js';
import { calculateWorkItems } from './work-calculation.js';
import { fraction, add, multiply, render, type Fraction } from './fractions.js';

const zero = () => fraction(0n);
type TargetPlan = Pick<PlanInput, 'startDate' | 'endDate' | 'granularity' | 'items'> & { weekConvention?: WeekConvention };

// Both the plan series and ProgressService use this exact daily allocation.
export function planTargetsBetween(plan: TargetPlan, start: string, end: string): Map<string, Fraction> {
  const source = periods(plan.startDate, plan.endDate, plan.granularity, plan.weekConvention);
  return new Map(plan.items.map(item => {
    let value = zero();
    source.forEach((part, index) => {
      const first = part.start > start ? part.start : start, last = part.end < end ? part.end : end;
      if (first <= last) value = add(value, fraction(scaled(item.targets[index], 6) * BigInt(daysBetween(first, last) + 1), 1000000n * BigInt(part.days)));
    });
    return [item.workItemId, value];
  }));
}

export function calculatePlan(plan: TargetPlan, basis: WorkItemRecord[], type: PeriodType): PlanSeries {
  const target = periods(plan.startDate, plan.endDate, type, plan.weekConvention);
  const work = calculateWorkItems(basis), total = scaled(work.totalAmount, 8);
  if (total === 0n) throw new Error('Basis nilai rencana harus positif.');
  const amounts = new Map(work.items.map(item => [item.id, scaled(item.amount, 8)]));
  const volumes = new Map(basis.map(item => [item.id, scaled(item.contractVolume, 6)]));
  const weighted = target.map(zero);
  const allocations = target.map(period => planTargetsBetween(plan, period.start, period.end));
  const items = plan.items.map(item => {
    let cumulative = zero();
    const increments = target.map((period, index) => {
      const value = allocations[index].get(item.workItemId)!;
      weighted[index] = add(weighted[index], multiply(value, fraction(amounts.get(item.workItemId)!, total)));
      cumulative = add(cumulative, value);
      return { target: render(value), cumulative: render(cumulative), quantity: render(multiply(value, fraction(volumes.get(item.workItemId)!, 100000000n))) };
    });
    return { workItemId: item.workItemId, targets: increments.map(p => p.target), cumulative: increments.map(p => p.cumulative), quantities: increments.map(p => p.quantity) };
  });
  let cumulative = zero();
  return { items, periods: target.map((period, index) => { cumulative = add(cumulative, weighted[index]); return { ...period, weighted: render(weighted[index]), cumulative: render(cumulative) }; }) };
}
