// Seeds a review account with sample data so the app can be reviewed immediately.
// Credentials are intentionally simple for the review environment only.
import * as auth from "./auth.js";
import * as repo from "./repo.js";
import { deriveVisual } from "./public/shared/visuals.js";

export const REVIEW_EMAIL = "review@example.com";
export const REVIEW_PASSWORD = "review-access";

export function seedReviewAccount() {
  if (auth.verifyUser(REVIEW_EMAIL, REVIEW_PASSWORD)) return; // already seeded
  let user;
  try { user = auth.createUser(REVIEW_EMAIL, REVIEW_PASSWORD); } catch { return; }
  const uid = user.id;
  const now = Date.now();
  const mk = (url, title, description, tags, opts = {}) => {
    const vis = deriveVisual(url);
    return repo.create(uid, {
      url, title, description, icon: vis.icon, preview: vis.preview,
      tags, note: opts.note || "", toRead: !!opts.toRead, archived: !!opts.archived,
      savedAt: opts.savedAt || now,
    });
  };
  mk("https://en.wikipedia.org/wiki/Bookmark_(digital)", "Bookmark (digital) — Wikipedia",
    "Overview of digital bookmarking on the web.", ["reference", "web"], { toRead: true, savedAt: now - 1000 });
  mk("https://developer.mozilla.org/en-US/docs/Web/CSS", "CSS — MDN Web Docs",
    "Reference documentation for CSS.", ["dev", "reference"], { note: "## Read for\n- grid\n- container queries", savedAt: now - 2000 });
  const b3 = mk("https://example.com/travel/rome-guide", "A weekend in Rome",
    "Travel notes and recommendations for Rome.", ["travel", "article"], { toRead: true, savedAt: now - 3000 });
  repo.setSnapshot(uid, b3.id, { kind: "page", mime: "text/html", content: "<!DOCTYPE html><html><head><meta charset='utf-8'><title>A weekend in Rome</title></head><body><h1>A weekend in Rome</h1><p>This is a self-contained preserved copy of the page, captured for offline reading. It still opens even if the original site changes or disappears.</p></body></html>" });
  mk("https://news.example.com/tech/story", "Old tech story", "An article kept for reference.",
    ["news"], { archived: true, savedAt: now - 4000 });
}
