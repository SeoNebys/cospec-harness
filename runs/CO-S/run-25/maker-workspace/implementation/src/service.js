"use strict";
// Application service: enforces the approved behaviour on top of the store and fetcher.

const { normUrl, hostOf, canon, isPlausibleUrl } = require("../shared/urls.js");

class ValidationError extends Error {
  constructor(code, message, extra) {
    super(message);
    this.code = code;
    this.extra = extra || {};
  }
}

function normTag(t) { return String(t == null ? "" : t).trim().toLowerCase(); }

function createService(store, fetcher) {
  function list() { return store.all(); }
  function get(id) { return store.get(id); }

  function findDuplicate(rawUrl, exceptId) {
    const c = canon(rawUrl);
    return store.all().find((it) => it.id !== exceptId && canon(it.url) === c) || null;
  }

  // Fetch details + preserve a copy into the item. Never throws; on failure marks the copy unavailable.
  async function captureInto(item) {
    const result = await fetcher.fetchAndPreserve(item.url);
    if (result && result.ok) {
      store.saveCopy(item.id, result.kind, result.buffer);
      store.update(item.id, {
        title: item.titleLocked ? item.title : (result.title || hostOf(item.url)),
        desc: item.titleLocked ? item.desc : (result.desc || ""),
        capturedAt: new Date().toISOString(),
        copy: { status: "ok", kind: result.kind },
      });
    } else {
      store.update(item.id, {
        title: item.title || item.url,
        capturedAt: null,
        copy: { status: "unavailable", kind: null },
      });
    }
    return store.get(item.id);
  }

  // SCN-001 / SCN-008 / SCN-011: validate, block duplicates, save, then capture.
  async function save(rawUrl) {
    const raw = String(rawUrl == null ? "" : rawUrl).trim();
    if (!raw) throw new ValidationError("empty", "Please paste a web address to save.");
    if (!isPlausibleUrl(raw)) {
      throw new ValidationError("not_a_url", "That doesn't look like a web address.");
    }
    const dup = findDuplicate(raw);
    if (dup) throw new ValidationError("duplicate", "This link is already saved.", { existing: dup });

    const url = normUrl(raw);
    const item = store.create({ url, host: hostOf(url), copy: { status: "pending", kind: null } });
    return captureInto(item);
  }

  function retry(id) {
    const item = store.get(id);
    if (!item) return null;
    return captureInto(item);
  }

  // SCN-001 (rename) + SCN-008 (edit title/address/description).
  async function edit(id, patch) {
    const item = store.get(id);
    if (!item) throw new ValidationError("not_found", "Link not found.");
    const nextUrl = patch.url !== undefined ? String(patch.url).trim() : item.url;
    if (!nextUrl) throw new ValidationError("empty", "An address is required.");
    if (!isPlausibleUrl(nextUrl)) throw new ValidationError("not_a_url", "That doesn't look like a web address.");

    const addressChanged = canon(nextUrl) !== canon(item.url);
    if (addressChanged) {
      const clash = findDuplicate(nextUrl, item.id);
      if (clash) throw new ValidationError("duplicate", "Another saved link already uses that address.", { existing: clash });
      // New page: keep tags & note; refresh details and capture a fresh copy.
      store.update(item.id, {
        url: normUrl(nextUrl),
        host: hostOf(nextUrl),
        copy: { status: "pending", kind: null },
        titleLocked: false,
      });
      return captureInto(store.get(item.id));
    }

    // Title/description-only edits are kept exactly as entered.
    const p = {};
    if (patch.title !== undefined) p.title = String(patch.title).trim() || item.host;
    if (patch.desc !== undefined) p.desc = String(patch.desc);
    return store.update(item.id, p);
  }

  function setNote(id, note) {
    return store.get(id) ? store.update(id, { note: String(note == null ? "" : note) }) : null;
  }
  function setToRead(id, value) {
    return store.get(id) ? store.update(id, { toRead: !!value }) : null;
  }
  function setArchived(id, value) {
    return store.get(id) ? store.update(id, { archived: !!value }) : null;
  }

  function addTag(id, tag) {
    const item = store.get(id);
    if (!item) return null;
    const v = normTag(tag);
    if (v && !item.tags.includes(v)) item.tags.push(v);
    return store.update(id, { tags: item.tags });
  }
  function removeTag(id, tag) {
    const item = store.get(id);
    if (!item) return null;
    const v = normTag(tag);
    return store.update(id, { tags: item.tags.filter((t) => t !== v) });
  }

  function remove(id) { return store.remove(id); }

  // SCN-010 bulk actions applied only to the given ids.
  function bulk(ids, action, arg) {
    const idset = new Set(ids || []);
    const targets = store.all().filter((it) => idset.has(it.id));
    let affected = 0;
    for (const it of targets) {
      switch (action) {
        case "toread": store.update(it.id, { toRead: true }); affected++; break;
        case "read": store.update(it.id, { toRead: false }); affected++; break;
        case "archive": store.update(it.id, { archived: true }); affected++; break;
        case "restore": store.update(it.id, { archived: false }); affected++; break;
        case "addTag": {
          const v = normTag(arg);
          if (v && !it.tags.includes(v)) { it.tags.push(v); store.update(it.id, { tags: it.tags }); }
          affected++; break;
        }
        case "removeTag": {
          const v = normTag(arg);
          store.update(it.id, { tags: it.tags.filter((t) => t !== v) });
          affected++; break;
        }
        case "delete": store.remove(it.id); affected++; break;
        default: throw new ValidationError("bad_action", "Unknown bulk action.");
      }
    }
    return { affected };
  }

  function getCopy(id) {
    const item = store.get(id);
    if (!item || item.copy.status !== "ok") return null;
    return { kind: item.copy.kind, buffer: store.readCopy(id, item.copy.kind) };
  }

  return {
    list, get, findDuplicate, captureInto, save, retry, edit,
    setNote, setToRead, setArchived, addTag, removeTag, remove, bulk, getCopy,
  };
}

module.exports = { createService, ValidationError };
