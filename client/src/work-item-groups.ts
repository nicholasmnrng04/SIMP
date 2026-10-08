import type { WorkItemRecord } from '../../shared/work-items';

/** Keep every option tied to its work item ID, regardless of database row order. */
export function groupWorkItems(basis: WorkItemRecord[]) {
  const children = new Map<string | null, WorkItemRecord[]>();
  for (const item of basis) {
    const siblings = children.get(item.parentId) ?? [];
    siblings.push(item);
    children.set(item.parentId, siblings);
  }
  for (const siblings of children.values()) siblings.sort((a, b) => a.code.localeCompare(b.code, 'id', { numeric: true }) || a.id.localeCompare(b.id));
  const groups: { label: string; items: WorkItemRecord[] }[] = [];
  const visited = new Set<string>();
  const visit = (item: WorkItemRecord, groupLabel: string) => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    if (item.kind === 'ITEM') {
      const label = groupLabel || 'Tanpa kelompok';
      const last = groups.at(-1);
      if (last?.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
      return;
    }
    for (const child of children.get(item.id) ?? []) visit(child, `${item.code} · ${item.name}`);
  };
  for (const root of children.get(null) ?? []) visit(root, '');
  for (const item of basis) if (!visited.has(item.id)) visit(item, '');
  return groups;
}
