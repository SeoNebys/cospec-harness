/*
 * app.js — DOM wiring for the bookmark app.
 * Uses BM (core.js) for all logic and BMStore (store.js) for persistence.
 */
(function () {
  "use strict";

  var items = BMStore.load();

  var $ = function (id) { return document.getElementById(id); };
  var listEl = $("list"), emptyEl = $("empty"), countEl = $("count"),
      qEl = $("q"), clearEl = $("clear"), urlEl = $("url"), tagsEl = $("tags"),
      noticeEl = $("notice"), adderEl = $("adder");

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // Highlight the matched substring (SCN-002).
  function highlight(text, query) {
    var s = String(text);
    if (!query) return esc(s);
    var i = s.toLowerCase().indexOf(query.toLowerCase());
    if (i < 0) return esc(s);
    return esc(s.slice(0, i)) + "<mark>" + esc(s.slice(i, i + query.length)) +
           "</mark>" + esc(s.slice(i + query.length));
  }

  function persist() { BMStore.save(items); }

  function render(flashKey) {
    var q = qEl.value.trim();
    clearEl.style.display = qEl.value ? "block" : "none";
    var rows = BM.filterItems(items, q);
    listEl.innerHTML = "";

    if (items.length === 0) {
      // Initial empty state.
      emptyEl.style.display = "block";
      emptyEl.textContent = "Nothing saved yet. Paste a link above to get started.";
      countEl.textContent = "";
      return;
    }
    if (rows.length === 0) {
      // SCN-005: no search matches.
      emptyEl.style.display = "block";
      emptyEl.textContent = "No links match “" + q + "”.";
      countEl.textContent = "";
      return;
    }
    emptyEl.style.display = "none";
    countEl.textContent = q
      ? rows.length + " of " + items.length + (items.length === 1 ? " link" : " links")
      : items.length + (items.length === 1 ? " link" : " links");

    rows.forEach(function (d) {
      var li = document.createElement("li");
      if (flashKey && d.key === flashKey) li.className = "flash";
      var tagHtml = d.tags.map(function (t) {
        return '<span class="t" data-tag="' + esc(t) + '">' + highlight(t, q) + "</span>";
      }).join("");
      li.innerHTML =
        '<div class="favicon">' + esc((d.host[0] || "?").toUpperCase()) + "</div>" +
        '<div class="meta">' +
          '<div class="title"><a href="' + esc(d.url) + '" target="_blank" rel="noreferrer">' +
            highlight(d.title, q) + "</a></div>" +
          '<div class="url">' + highlight(d.host, q) + "</div>" +
          (d.tags.length ? '<div class="tags">' + tagHtml + "</div>" : "") +
        "</div>";
      listEl.appendChild(li);
    });

    // Clicking a tag drops its word into the single search box (SCN-003).
    Array.prototype.forEach.call(listEl.querySelectorAll(".t"), function (el) {
      el.addEventListener("click", function () {
        qEl.value = el.getAttribute("data-tag");
        render();
        qEl.focus();
      });
    });

    // Bring a flashed (jumped-to) entry into view (SCN-007).
    if (flashKey) {
      var flashed = listEl.querySelector(".flash");
      if (flashed && flashed.scrollIntoView) {
        flashed.scrollIntoView({ block: "nearest" });
      }
    }
  }

  adderEl.addEventListener("submit", function (e) {
    e.preventDefault();
    noticeEl.className = "notice";
    noticeEl.textContent = "";

    var result = BM.addLink(items, urlEl.value, tagsEl.value);

    switch (result.status) {
      case "empty":
        return;
      case "invalid": // SCN-006
        noticeEl.className = "notice err";
        noticeEl.textContent = "That doesn't look like a link — a link usually has a dot in it, like example.com/page.";
        return;
      case "duplicate": // SCN-007
        noticeEl.className = "notice dup";
        noticeEl.textContent = "You've already saved this one — here it is.";
        urlEl.value = "";
        tagsEl.value = "";
        qEl.value = "";
        render(result.key);
        urlEl.focus();
        return;
      case "added": // SCN-001 / SCN-003
        items = result.items;
        persist();
        urlEl.value = "";
        tagsEl.value = "";
        qEl.value = "";
        render(result.key);
        urlEl.focus();
        return;
    }
  });

  qEl.addEventListener("input", function () { render(); });
  clearEl.addEventListener("click", function () {
    qEl.value = "";
    render();
    qEl.focus();
  });

  render();
})();
