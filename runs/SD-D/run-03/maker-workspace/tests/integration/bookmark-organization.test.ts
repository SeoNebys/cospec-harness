import { withFastifyTestHarness } from "../helpers/fastify.js";

describe("bookmark organization", () => {
  it("atomically edits text, normalized tags, formatted note, and independent states", async () => {
    await withFastifyTestHarness(async ({ injectJson, testDatabase }) => {
      const created = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/organize", unread: true },
      });
      const id = created.json().id as number;
      const updated = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${id}`,
        payload: {
          title: "My reference",
          description: "Personal context",
          tags: [" News ", "news", "Machine   Learning"],
          noteMarkdown: "## Why it matters\n\n- **Useful** [source](https://example.com)\n- `code`",
          favorite: true,
        },
      });

      expect(updated.statusCode).toBe(200);
      expect(updated.json()).toMatchObject({
        title: "My reference",
        titleProvenance: "user",
        description: "Personal context",
        descriptionProvenance: "user",
        favorite: true,
        unread: true,
      });
      expect(updated.json().tags.map((tag: { name: string }) => tag.name)).toEqual([
        "Machine Learning",
        "News",
      ]);
      const row = testDatabase.database
        .prepare("SELECT note_plain, title_sort_key FROM bookmarks WHERE id = ?")
        .get(id) as { note_plain: string; title_sort_key: string };
      expect(row.note_plain).toContain("Why it matters");
      expect(row.note_plain).toContain("Useful source");
      expect(row.title_sort_key).toBe("my reference");
    });
  });

  it("archives an unread favorite without clearing it and resurfaces it on restore", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const created = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: {
          address: "https://example.com/read-later-archive",
          favorite: true,
          unread: true,
        },
      });
      const id = created.json().id as number;

      const archived = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${id}`,
        payload: { archived: true },
      });
      expect(archived.json()).toMatchObject({ archived: true, favorite: true, unread: true });
      const hidden = await injectJson({ method: "GET", url: "/api/bookmarks?scope=read_later" });
      expect(hidden.json().items).toEqual([]);

      const restored = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${id}`,
        payload: { archived: false },
      });
      expect(restored.json()).toMatchObject({ archived: false, favorite: true, unread: true });
      const resurfaced = await injectJson({
        method: "GET",
        url: "/api/bookmarks?scope=read_later",
      });
      expect(resurfaced.json().items.map((item: { id: number }) => item.id)).toContain(id);
    });
  });

  it("rolls back an address change on duplicate and increments revision on a valid change", async () => {
    await withFastifyTestHarness(async ({ injectJson, testDatabase }) => {
      const first = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/first", title: "Keep me" },
      });
      const second = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: { address: "https://example.com/second" },
      });

      const conflict = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${first.json().id}`,
        payload: { address: "https://EXAMPLE.com:443/second" },
      });
      expect(conflict.statusCode).toBe(409);
      expect(conflict.json()).toMatchObject({ existingBookmarkId: second.json().id });
      expect(
        (await injectJson({ method: "GET", url: `/api/bookmarks/${first.json().id}` })).json()
          .address,
      ).toBe("https://example.com/first");

      const changed = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${first.json().id}`,
        payload: { address: "https://example.com/revised" },
      });
      expect(changed.statusCode).toBe(200);
      expect(changed.json()).toMatchObject({
        address: "https://example.com/revised",
        title: "Keep me",
        titleProvenance: "user",
        metadataStatus: "pending",
      });
      expect(
        testDatabase.database
          .prepare("SELECT address_revision FROM bookmarks WHERE id = ?")
          .get(first.json().id),
      ).toEqual({ address_revision: 2 });
    });
  });

  it("replaces tags, cleans orphans, accepts metadata candidates, and updates search atomically", async () => {
    await withFastifyTestHarness(async ({ injectJson, testDatabase, clock }) => {
      const created = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: {
          address: "https://example.com/searchable-edit",
          tags: ["News", "Temporary"],
          noteMarkdown: "Initial needle",
        },
      });
      const id = created.json().id as number;
      testDatabase.database
        .prepare(
          "UPDATE bookmarks SET retrieved_description_candidate = 'Retrieved context' WHERE id = ?",
        )
        .run(id);
      const createdAt = created.json().createdAt as string;
      clock.advance({ minutes: 5 });

      const updated = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${id}`,
        payload: {
          tags: [" news ", "Research"],
          noteMarkdown: "Replacement searchable phrase",
          acceptRetrievedDescription: true,
        },
      });

      expect(updated.statusCode).toBe(200);
      expect(updated.json()).toMatchObject({
        description: "Retrieved context",
        descriptionProvenance: "retrieved",
        retrievedDescriptionCandidate: null,
        createdAt,
        updatedAt: clock.iso(),
      });
      expect(updated.json().tags.map((tag: { name: string }) => tag.name)).toEqual([
        "News",
        "Research",
      ]);
      expect(
        testDatabase.database.prepare("SELECT display_name FROM tags ORDER BY name_key").all(),
      ).toEqual([{ display_name: "News" }, { display_name: "Research" }]);
      expect(
        (
          await injectJson({
            method: "GET",
            url: "/api/bookmarks?q=replacement%20%23research",
          })
        )
          .json()
          .items.map((bookmark: { id: number }) => bookmark.id),
      ).toEqual([id]);
      expect(
        (await injectJson({ method: "GET", url: "/api/bookmarks?q=needle" })).json().items,
      ).toEqual([]);
    });
  });

  it("rolls back every field when note or address validation fails", async () => {
    await withFastifyTestHarness(async ({ injectJson }) => {
      const created = await injectJson({
        method: "POST",
        url: "/api/bookmarks",
        payload: {
          address: "https://example.com/atomic-validation",
          title: "Original",
          favorite: true,
        },
      });
      const id = created.json().id as number;

      const unsafeNote = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${id}`,
        payload: {
          title: "Must roll back",
          noteMarkdown: "[unsafe](javascript:alert(1))",
          favorite: false,
        },
      });
      expect(unsafeNote.statusCode).toBe(422);
      expect(unsafeNote.json()).toMatchObject({ code: "UNSAFE_NOTE_LINK", field: "noteMarkdown" });

      const badAddress = await injectJson({
        method: "PATCH",
        url: `/api/bookmarks/${id}`,
        payload: { address: "file:///etc/passwd", title: "Also rolls back" },
      });
      expect(badAddress.statusCode).toBe(422);
      expect(badAddress.json()).toMatchObject({ field: "address" });

      expect(
        (await injectJson({ method: "GET", url: `/api/bookmarks/${id}` })).json(),
      ).toMatchObject({
        address: "https://example.com/atomic-validation",
        title: "Original",
        favorite: true,
        noteMarkdown: "",
      });
    });
  });
});
