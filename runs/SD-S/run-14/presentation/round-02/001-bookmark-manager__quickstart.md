# Quickstart Validation: Bookmark Manager

## Prerequisites

- Node.js 24 and npm
- Chromium available through the workspace Playwright installation
- Port 4000 available

## Prepare and run

After implementation tasks are complete:

```bash
npm install
npm test
npm run build
npm start
```

The server must listen on `0.0.0.0:4000`. Review it at `http://maker:4000/`. Automated browser checks use `http://127.0.0.1:4000/`.

Run browser validation separately:

```bash
npm run test:e2e
```

## End-to-end validation scenarios

1. **Save and persist**: From an empty collection, add `example.com` with a title, description, and two tags. Confirm it appears as normalized HTTPS, reload, and confirm every value remains.
2. **Open safely**: Open the bookmark and confirm its destination uses a new tab while the collection retains its state.
3. **Validate mistakes**: Submit empty required fields, a malformed address, and an unsupported scheme. Confirm no write occurs and each error explains a correction.
4. **Duplicate decision**: Save an equivalent canonical address. Cancel once and confirm no duplicate; repeat, choose “Save duplicate,” and confirm the additional record.
5. **Find and filter**: Seed varied bookmarks. Search each supported field, filter by one tag, combine both controls, clear them, and verify result counts and the no-match recovery action.
6. **Edit and cancel**: Change every editable field and save; reload and verify the values. Begin another edit, cancel, and confirm the persisted values remain.
7. **Delete and cancel**: Start deletion and cancel; confirm the bookmark remains. Confirm deletion next and reload to verify removal.
8. **Failure safety**: Simulate a rejected storage mutation and verify the prior collection remains visible with an actionable error.
9. **Scale**: Load 1,000 representative bookmarks and confirm search or filtering displays results within 1 second and a known bookmark is findable within 10 seconds.
10. **Accessibility**: Complete create, search, edit, duplicate confirmation, and deletion with keyboard only; verify labels, error associations, visible focus, dialog focus containment/restoration, and representative axe checks.

The detailed field and interaction rules are in [data-model.md](data-model.md) and [contracts/ui-contract.md](contracts/ui-contract.md).
