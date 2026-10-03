// JSON-file persistence for bookmarks, saved views and settings.
'use strict';
var fs = require('fs');
var path = require('path');

function Store(dir) {
  this.dir = dir;
  this.file = path.join(dir, 'store.json');
  this.snapDir = path.join(dir, 'snapshots');
  fs.mkdirSync(this.snapDir, { recursive: true });
  this._load();
}

Store.prototype._load = function () {
  try {
    this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
  } catch (e) {
    this.data = { seq: 0, bookmarks: [], views: [], settings: { sort: 'new', pageSize: 10, textSize: 'm' } };
  }
  if (!this.data.settings) this.data.settings = { sort: 'new', pageSize: 10, textSize: 'm' };
  if (!this.data.views) this.data.views = [];
  if (!this.data.bookmarks) this.data.bookmarks = [];
  if (typeof this.data.seq !== 'number') this.data.seq = this.data.bookmarks.length;
};

Store.prototype.save = function () {
  var tmp = this.file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
  fs.renameSync(tmp, this.file);
};

Store.prototype.state = function () {
  return { bookmarks: this.data.bookmarks, views: this.data.views, settings: this.data.settings };
};

Store.prototype.nextId = function () { this.data.seq += 1; return this.data.seq; };

Store.prototype.byId = function (id) {
  id = Number(id);
  return this.data.bookmarks.find(function (b) { return b.id === id; }) || null;
};

Store.prototype.findByUrl = function (url) {
  return this.data.bookmarks.find(function (b) { return b.url === url; }) || null;
};

// snapshot file helpers
Store.prototype.snapshotPath = function (id, kind) {
  return path.join(this.snapDir, id + (kind === 'pdf' ? '.pdf' : '.html'));
};
Store.prototype.writeSnapshot = function (id, kind, dataBufOrStr) {
  // remove any prior snapshot of the other kind
  ['html', 'pdf'].forEach(function (k) {
    var p = this.snapshotPath(id, k);
    if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch (e) { } }
  }.bind(this));
  fs.writeFileSync(this.snapshotPath(id, kind), dataBufOrStr);
};
Store.prototype.removeSnapshot = function (id) {
  ['html', 'pdf'].forEach(function (k) {
    var p = this.snapshotPath(id, k);
    if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch (e) { } }
  }.bind(this));
};

module.exports = Store;
