'use strict';

const fs = require('fs');
const path = require('path');

// Simple file-backed store so bookmarks persist across sessions (SCN-008).
// One JSON document holding an array of bookmarks plus the id counter. Writes
// are atomic (write temp then rename) to avoid corruption on crash.

function createStore(filePath) {
  const dir = path.dirname(filePath);

  function load() {
    try {
      const txt = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(txt);
      if (!data || !Array.isArray(data.bookmarks)) {
        return { bookmarks: [], nextId: 1 };
      }
      return { bookmarks: data.bookmarks, nextId: data.nextId || 1 };
    } catch (e) {
      // Missing or unreadable file -> start empty.
      return { bookmarks: [], nextId: 1 };
    }
  }

  function save(state) {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  }

  return { load, save };
}

module.exports = { createStore };
