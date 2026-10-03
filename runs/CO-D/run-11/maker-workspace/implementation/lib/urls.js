// URL normalisation / validation shared by server and browser.
(function () {
  function normalize(u) {
    u = (u || '').trim();
    if (!u) return '';
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    return u.replace(/\/+$/, ''); // trailing slash ignored for duplicate matching
  }
  function hostOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u; }
  }
  function isValid(u) {
    try {
      var x = new URL(u);
      if (x.protocol !== 'http:' && x.protocol !== 'https:') return false;
      if (/\s/.test(u)) return false;
      if (x.hostname.indexOf('.') < 0) return false;
      return true;
    } catch (e) { return false; }
  }
  function isPdf(u) { return /\.pdf(\?|#|$)/i.test(u || ''); }

  var api = { normalize: normalize, hostOf: hostOf, isValid: isValid, isPdf: isPdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else this.BMUrls = api;
}).call(typeof window !== 'undefined' ? window : this);
