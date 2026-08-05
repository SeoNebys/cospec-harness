import { CollectionView } from '../components/CollectionView';

// Archived view (FR-016): items tucked aside, kept out of the main list and
// default search. Restore or permanently delete from here.
export function ArchivedPage({ reloadToken }: { reloadToken: number }) {
  return (
    <CollectionView
      view="archived"
      reloadToken={reloadToken}
      emptyTitle="Nothing archived"
      emptyHint="Archive a bookmark to tuck it aside without deleting it."
    />
  );
}
