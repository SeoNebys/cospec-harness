import { beforeEach, describe, expect, it } from "vitest";
import { createDb } from "@/lib/db/client";
import { BookmarkRepository } from "@/lib/bookmarks/repository";
import { BookmarkService } from "@/lib/bookmarks/service";
import { AppProblem } from "@/lib/http/problem";
function service() {
  return new BookmarkService(new BookmarkRepository(createDb()));
}
describe("bookmark service", () => {
  let app: BookmarkService;
  beforeEach(() => (app = service()));
  it("creates, persists, updates and deletes", () => {
    const made = app.create({
      url: "https://example.com",
      title: "Example",
      tags: ["Research"]
    });
    expect(made.readingStatus).toBe("to_read");
    expect(app.get(made.id).tags[0].name).toBe("Research");
    expect(app.update(made.id, { title: "Changed" })?.title).toBe("Changed");
    app.delete(made.id);
    expect(() => app.get(made.id)).toThrow(AppProblem);
  });
  it("warns on normalized duplicates but permits an override", () => {
    app.create({ url: "https://example.com#one", title: "One" });
    expect(() =>
      app.create({ url: "https://EXAMPLE.com/", title: "Two" })
    ).toThrowError(/another copy/i);
    expect(
      app.create({
        url: "https://example.com/",
        title: "Two",
        allowDuplicate: true
      }).title
    ).toBe("Two");
  });
});
