import { useState } from 'react';
import type { ProgressItem } from '../../../shared/progress';
import { displayDecimal } from '../../../shared/work-items';

/** Keep ancestors visible when searching so a matching item retains its context. */
export function filterWorkRows<T extends { id: string; parentId: string | null; code: string; name: string }>(items: T[], search: string, group = ''): T[] {
  const byId = new Map(items.map(item => [item.id, item]));
  const ancestors = (item: T) => {
    const ids = new Set<string>();
    let parent = item.parentId;
    while (parent && !ids.has(parent)) { ids.add(parent); parent = byId.get(parent)?.parentId ?? null; }
    return ids;
  };
  const selected = new Set<string>();
  for (const item of items) {
    const parents = ancestors(item);
    if ((!group || item.id === group || parents.has(group)) && `${item.code} ${item.name}`.toLocaleLowerCase('id-ID').includes(search.trim().toLocaleLowerCase('id-ID'))) {
      selected.add(item.id); parents.forEach(id => selected.add(id));
    }
  }
  return items.filter(item => selected.has(item.id));
}

const percent = (value: string | null, precision = 2) => value === null ? '—' : `${displayDecimal(value, precision)}%`;
function ProgressBar({ value, label }: { value: string | null; label: string }) {
  return <div className="work-progress-value"><span>{percent(value)}</span>{value !== null && <span className={`work-progress-track ${label === 'Target' ? 'target' : 'actual'}`} aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, Number(value)))}%` }} /></span>}</div>;
}

export function WorkProgressTable({ items }: { items: ProgressItem[] }) {
  const [search, setSearch] = useState('');
  const rows = filterWorkRows(items, search);
  return <section className="work-progress-overview" aria-label="Perbandingan kemajuan pekerjaan">
    <div className="section-heading"><div><h2>Kemajuan per pekerjaan</h2><p>Target dan capaian fisik sampai tanggal yang dipilih.</p></div><label>Cari uraian pekerjaan<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Kode atau nama pekerjaan" /></label></div>
    <div className="responsive-table" tabIndex={0} role="region" aria-label="Tabel kemajuan pekerjaan yang dapat digeser"><table className="work-progress-table"><thead><tr><th scope="col">Uraian pekerjaan</th><th scope="col">Target fisik</th><th scope="col">Capaian fisik</th><th scope="col">Rincian</th></tr></thead><tbody>
      {rows.map(item => item.kind === 'GROUP' ? <tr className="work-group-row" key={item.id}><th scope="row" colSpan={4}>{item.code} · {item.name}<small>Kontribusi terhadap proyek: target {percent(item.target.cumulative.weighted)} · capaian {percent(item.actual.cumulative.weighted)}</small></th></tr> : <tr key={item.id}>
        <th scope="row"><span className="work-row-code">{item.code}</span>{item.name}</th><td><ProgressBar label="Target" value={item.target.cumulative.physical} /></td><td><ProgressBar label="Capaian" value={item.actual.cumulative.physical} /></td><td><details><summary>Angka lengkap</summary><dl><dt>Bobot</dt><dd>{percent(item.weight, 6)}</dd><dt>Target fisik</dt><dd>{percent(item.target.cumulative.physical, 6)}</dd><dt>Capaian fisik</dt><dd>{percent(item.actual.cumulative.physical, 6)}</dd><dt>Kontribusi target</dt><dd>{percent(item.target.cumulative.weighted, 6)}</dd><dt>Kontribusi capaian</dt><dd>{percent(item.actual.cumulative.weighted, 6)}</dd></dl></details></td>
      </tr>)}
      {!rows.length && <tr><td colSpan={4}>{items.length ? 'Tidak ada pekerjaan yang sesuai pencarian.' : 'Belum ada pekerjaan untuk ditampilkan.'}</td></tr>}
    </tbody></table></div><p className="muted small">Baris kelompok menunjukkan kontribusi terhadap proyek, bukan persentase fisik kelompok. Angka belum tersedia ditandai —.</p>
  </section>;
}
