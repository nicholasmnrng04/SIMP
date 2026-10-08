import { decimal, scaled, type WorkCalculation, type WorkItemRecord } from '../../shared/work-items.js';
import { AppError } from '../errors.js';

const invalidTree = () => new AppError(409, 'INVALID_WORK_TREE', 'Struktur pekerjaan tidak valid. Periksa induk dan siklus pekerjaan.');
// Satu perhitungan untuk UI, rencana, laporan dan ekspor berikutnya. Tidak menjumlah bobot/uang tampilan.
export function calculateWorkItems(rows: WorkItemRecord[]): WorkCalculation {
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (byId.size !== rows.length) throw invalidTree();
  const children = new Map<string | null, WorkItemRecord[]>();
  for (const row of rows) {
    if (row.parentId && (!byId.has(row.parentId) || byId.get(row.parentId)!.kind !== 'GROUP')) throw invalidTree();
    const siblings = children.get(row.parentId) ?? []; siblings.push(row); children.set(row.parentId, siblings);
  }
  for (const siblings of children.values()) siblings.sort((a, b) => a.code.localeCompare(b.code, 'id', { numeric: true }) || a.id.localeCompare(b.id));
  const remaining = new Map(rows.map((row) => [row.id, children.get(row.id)?.length ?? 0]));
  const amounts = new Map<string, bigint>(rows.map((row) => [row.id, row.kind === 'ITEM' ? scaled(row.contractVolume, 6) * scaled(row.unitPrice, 2) : 0n]));
  const queue = rows.filter((row) => remaining.get(row.id) === 0);
  for (let i = 0; i < queue.length; i++) {
    const row = queue[i];
    if (row.parentId) {
      amounts.set(row.parentId, amounts.get(row.parentId)! + amounts.get(row.id)!);
      const count = remaining.get(row.parentId)! - 1; remaining.set(row.parentId, count);
      if (!count) queue.push(byId.get(row.parentId)!);
    }
  }
  if (queue.length !== rows.length) throw invalidTree();
  const leaves = rows.filter((row) => row.kind === 'ITEM');
  const total = leaves.reduce((sum, row) => sum + amounts.get(row.id)!, 0n);
  // Pembulatan half-up dari rasio asli, terpisah untuk enam desimal API dan dua desimal tampilan.
  const weight = (amount: bigint, places: number) => total ? (amount * 100n * 10n ** BigInt(places) + total / 2n) / total : null;
  const displayTotal = leaves.reduce((sum, row) => sum + (weight(amounts.get(row.id)!, 2) ?? 0n), 0n);
  const stack = [...(children.get(null) ?? [])].reverse().map((row) => ({ row, depth: 0 }));
  const items: WorkCalculation['items'] = [];
  while (stack.length) {
    const { row, depth } = stack.pop()!, amount = amounts.get(row.id)!;
    items.push({ ...row, depth, amount: decimal(amount, 8), weight: total ? decimal(weight(amount, 6)!, 6) : null, displayWeight: total ? decimal(weight(amount, 2)!, 2) : null });
    stack.push(...[...(children.get(row.id) ?? [])].reverse().map((child) => ({ row: child, depth: depth + 1 })));
  }
  const difference = displayTotal > 10000n ? displayTotal - 10000n : 10000n - displayTotal;
  return { items, totalAmount: decimal(total, 8), totalWeight: total ? '100.000000' : null,
    displayedWeightTotal: decimal(displayTotal, 2), leafCount: leaves.length,
    warning: !total ? 'Bobot belum dapat dihitung karena total nilai item pekerjaan masih nol.' : difference > 1n ? 'Jumlah bobot tampilan berbeda lebih dari 0,01 poin dari 100% akibat pembulatan. Perhitungan tetap memakai nilai presisi penuh.' : null,
  };
}
