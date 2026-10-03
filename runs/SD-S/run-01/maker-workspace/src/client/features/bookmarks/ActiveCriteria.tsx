import type { ListCriteria } from '../../../shared/api-types';

export function ActiveCriteria({ criteria, onClear }: { criteria: ListCriteria; onClear: () => void }) {
  const labels: string[] = [];
  if (criteria.q) labels.push(`Search: “${criteria.q}”`);
  if (criteria.tag) labels.push(`Tag: ${criteria.tag}`);
  if (criteria.favorite) labels.push('Favorites only');
  if (!labels.length) return null;
  return (
    <div className="active-criteria" aria-label="Active filters">
      <div>{labels.map((label) => <span key={label}>{label}</span>)}</div>
      <button type="button" onClick={onClear}>Clear filters</button>
    </div>
  );
}
