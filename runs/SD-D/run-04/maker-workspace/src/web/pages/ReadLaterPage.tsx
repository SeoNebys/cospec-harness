import { CollectionView } from '../components/CollectionView';

// Read-later shortlist (FR-015): only bookmarks flagged "read later" (and not
// archived). Clear the flag from a card to drop it from this view.
export function ReadLaterPage({ reloadToken }: { reloadToken: number }) {
  return (
    <CollectionView
      view="readLater"
      reloadToken={reloadToken}
      emptyTitle="Nothing to read later"
      emptyHint="Flag a bookmark “★ Read later” and it’ll show up here."
    />
  );
}
