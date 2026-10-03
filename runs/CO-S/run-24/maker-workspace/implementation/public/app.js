// Front-end for the bookmark app. Talks to the JSON API and renders the approved
// behaviours. Domain rules (search, tag normalisation, ordering) come from the
// shared logic module so the browser and server agree.

import {
  hostOf,
  allTags,
  visibleLinks,
} from "./logic.js";

const state = {
  links: [],
  view: "all", // "all" | "list"
  q: "",
  tagFilters: [],
};
const ui = {
  editingNote: {}, // id -> bool
  confirmingDelete: {}, // id -> bool
  editingTitle: {}, // id -> bool
  addingDesc: {}, // id -> bool
  flashId: null,
};

const $ = (id) => document.getElementById(id);

// ---- API ----
async function apiGet() {
  const r = await fetch("/api/links");
  const d = await r.json();
  return d.links || [];
}
async function apiCreate(url) {
  const r = await fetch("/api/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function apiPatch(id, patch) {
  const r = await fetch(`/api/links/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  const d = await r.json().catch(() => ({}));
  return d.link || null;
}
async function apiDelete(id) {
  await fetch(`/api/links/${encodeURIComponent(id)}`, { method: "DELETE" });
}

function replaceLink(link) {
  const i = state.links.findIndex((l) => l.id === link.id);
  if (i === -1) state.links.push(link);
  else state.links[i] = link;
}

// ---- helpers ----
function colorFor(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 48%)`;
}
function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
function displayTitle(link) {
  if (link.title && link.title.trim()) return link.title.trim();
  const h = link.host || hostOf(link.url);
  const path = (() => {
    try { return new URL(link.url).pathname.replace(/\/+$/, ""); } catch { return ""; }
  })();
  return h + path;
}
function highlight(text) {
  const q = state.q.trim();
  if (!q) return document.createTextNode(text);
  const words = q.split(/\s+/).filter(Boolean).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return document.createTextNode(text);
  const re = new RegExp("(" + words.join("|") + ")", "ig");
  const frag = document.createDocumentFragment();
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const mk = document.createElement("mark");
    mk.textContent = m[0];
    frag.appendChild(mk);
    last = m.index + m[0].length;
    if (re.lastIndex === m.index) re.lastIndex++;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// ---- save message ----
let msgTimer = null;
function showSaveMsg(kind, text) {
  const m = $("savemsg");
  m.className = "savemsg " + (kind || "");
  m.textContent = text || "";
  clearTimeout(msgTimer);
  if (kind) msgTimer = setTimeout(() => { m.className = "savemsg"; m.textContent = ""; }, 4000);
}

// ---- toolbar ----
function renderToolbar() {
  const views = $("views");
  views.innerHTML = "";
  [["all", "All links"], ["list", "Reading list"]].forEach(([key, label]) => {
    const b = el("button", state.view === key ? "on" : null, label);
    b.onclick = () => { state.view = key; render(); };
    views.appendChild(b);
  });

  const f = $("filters");
  f.innerHTML = "";
  if (state.tagFilters.length) {
    f.appendChild(el("span", "lbl", "Filtered by:"));
    state.tagFilters.forEach((t) => {
      const c = el("span", "fchip");
      c.appendChild(document.createTextNode(t));
      c.appendChild(el("span", null, "×"));
      c.onclick = () => { state.tagFilters = state.tagFilters.filter((z) => z !== t); render(); };
      f.appendChild(c);
    });
    const ca = el("button", "clearall", "Clear");
    ca.onclick = () => { state.tagFilters = []; render(); };
    f.appendChild(ca);
  }

  const dl = $("known-tags");
  dl.innerHTML = "";
  allTags(state.links).forEach((t) => {
    const o = document.createElement("option");
    o.value = t;
    dl.appendChild(o);
  });
}

function toggleTagFilter(t) {
  if (state.tagFilters.indexOf(t) === -1) state.tagFilters.push(t);
  else state.tagFilters = state.tagFilters.filter((z) => z !== t);
  render();
}

// ---- one card ----
function renderCard(link) {
  const li = el("li", "link");
  li.setAttribute("data-id", link.id);
  if (ui.flashId === link.id) li.classList.add("flash");

  const host = link.host || hostOf(link.url);
  const ic = el("div", "favicon" + (link.autoFailed && !link.title ? " blank" : ""));
  if (link.autoFailed && !link.title) {
    ic.textContent = "?";
  } else {
    ic.style.background = colorFor(host);
    ic.textContent = (host[0] || "?").toUpperCase();
  }
  li.appendChild(ic);

  const body = el("div", "body");
  const top = el("div", "toprow");
  const mt = el("div", "maintext");

  if (link.loading) {
    mt.appendChild(el("p", "title loading", "Fetching page info…"));
  } else if (ui.editingTitle[link.id]) {
    const p = el("p", "title");
    const field = el("div", "linkfield");
    const inp = document.createElement("input");
    inp.type = "text";
    inp.placeholder = "Give this link a title you'll recognise";
    inp.value = link.title || "";
    const save = el("button", "act primary", "Save");
    save.onclick = async () => {
      const updated = await apiPatch(link.id, { title: inp.value.trim() });
      if (updated) replaceLink(updated);
      delete ui.editingTitle[link.id];
      render();
    };
    const cancel = el("button", "act", "Cancel");
    cancel.onclick = () => { delete ui.editingTitle[link.id]; render(); };
    field.append(inp, save, cancel);
    mt.appendChild(p);
    mt.appendChild(field);
    setTimeout(() => inp.focus(), 0);
  } else {
    const t = el("p", "title");
    const a = document.createElement("a");
    a.href = link.url; a.target = "_blank"; a.rel = "noopener";
    a.appendChild(highlight(displayTitle(link)));
    t.appendChild(a);
    mt.appendChild(t);
  }
  top.appendChild(mt);

  // reading-list control
  if (!link.loading) {
    const actwrap = el("div");
    actwrap.style.cssText = "display:flex;flex-direction:column;gap:6px;align-items:flex-end;";
    if (link.inList) {
      actwrap.appendChild(el("span", "statepill inlist", "In reading list"));
      const done = el("button", "act primary", "Done");
      done.onclick = async () => {
        const u = await apiPatch(link.id, { inList: false });
        if (u) replaceLink(u); render();
      };
      actwrap.appendChild(done);
    } else {
      const add = el("button", "act", "＋ Reading list");
      add.onclick = async () => {
        const u = await apiPatch(link.id, { inList: true });
        if (u) replaceLink(u); render();
      };
      actwrap.appendChild(add);
    }
    top.appendChild(actwrap);
  }
  body.appendChild(top);

  if (!link.loading) {
    // auto-fail notice + manual title affordance (SCN-006)
    if (link.autoFailed) {
      body.appendChild(el("span", "warn", "⚠︎ Couldn't load this page's title or description automatically."));
      if (!ui.editingTitle[link.id]) {
        const addt = el("button", "miniadd", (link.title ? "Edit the title" : "＋ Add a title yourself"));
        addt.onclick = () => { ui.editingTitle[link.id] = true; render(); };
        body.appendChild(addt);
      }
    }

    // description (auto-filled or manual) — SCN-001 / SCN-006
    if (link.description) {
      const d = el("p", "desc");
      d.appendChild(highlight(link.description));
      body.appendChild(d);
    } else if (ui.addingDesc[link.id]) {
      const field = el("div", "linkfield");
      const inp = document.createElement("input");
      inp.type = "text";
      inp.placeholder = "Add a short description (optional)";
      const save = el("button", "act primary", "Save");
      save.onclick = async () => {
        const u = await apiPatch(link.id, { description: inp.value.trim() });
        if (u) replaceLink(u);
        delete ui.addingDesc[link.id];
        render();
      };
      const cancel = el("button", "act", "Cancel");
      cancel.onclick = () => { delete ui.addingDesc[link.id]; render(); };
      field.append(inp, save, cancel);
      body.appendChild(field);
      setTimeout(() => inp.focus(), 0);
    } else if (link.autoFailed) {
      const addd = el("button", "miniadd", "＋ Add a description");
      addd.onclick = () => { ui.addingDesc[link.id] = true; render(); };
      body.appendChild(addd);
    }

    // tags (SCN-002)
    const tr = el("div", "tagrow");
    (link.tags || []).forEach((tag) => {
      const c = el("span", "tag" + (state.tagFilters.indexOf(tag) !== -1 ? " active" : ""));
      const label = el("span", null, tag);
      label.title = "Filter by " + tag;
      label.onclick = () => toggleTagFilter(tag);
      c.appendChild(label);
      const x = el("button", "x", "×");
      x.title = "Remove tag";
      x.onclick = async (ev) => {
        ev.stopPropagation();
        const next = (link.tags || []).filter((z) => z !== tag);
        const u = await apiPatch(link.id, { tags: next });
        if (u) replaceLink(u); render();
      };
      c.appendChild(x);
      tr.appendChild(c);
    });
    const tagInput = document.createElement("input");
    tagInput.className = "taginput";
    tagInput.placeholder = (link.tags && link.tags.length) ? "Add another…" : "Add a tag…";
    tagInput.setAttribute("list", "known-tags");
    tagInput.onkeydown = async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const v = tagInput.value.trim();
        if (!v) return;
        const next = (link.tags || []).concat([v]);
        const u = await apiPatch(link.id, { tags: next });
        if (u) replaceLink(u); render();
      }
    };
    tr.appendChild(tagInput);
    body.appendChild(tr);

    // note (SCN-004)
    if (ui.editingNote[link.id]) {
      const ne = el("div", "noteedit");
      const ta = document.createElement("textarea");
      ta.value = link.note || "";
      ta.placeholder = "Write a note to your future self…";
      ne.appendChild(ta);
      const nb = el("div", "nbtns");
      const sv = el("button", "act primary", "Save note");
      sv.onclick = async () => {
        const u = await apiPatch(link.id, { note: ta.value.trim() });
        if (u) replaceLink(u);
        delete ui.editingNote[link.id];
        render();
      };
      const cn = el("button", "act", "Cancel");
      cn.onclick = () => { delete ui.editingNote[link.id]; render(); };
      nb.append(sv, cn);
      ne.appendChild(nb);
      body.appendChild(ne);
      setTimeout(() => ta.focus(), 0);
    } else if (link.note) {
      const nv = el("p", "note");
      nv.title = "Click to edit this note";
      nv.appendChild(highlight(link.note));
      nv.onclick = () => { ui.editingNote[link.id] = true; render(); };
      body.appendChild(nv);
    } else {
      const na = el("button", "miniadd", "＋ Add a note");
      na.onclick = () => { ui.editingNote[link.id] = true; render(); };
      body.appendChild(na);
    }
  }

  // address + date
  const sec = el("p", "secondary", host + (link.loading ? "" : " · Saved " + fmtDate(link.savedAt)));
  body.appendChild(sec);

  // remove (SCN-007)
  if (!link.loading) {
    const rr = el("div", "removerow");
    if (ui.confirmingDelete[link.id]) {
      const cd = el("span", "confirmdel");
      cd.appendChild(document.createTextNode("Remove this link for good?"));
      const yes = el("button", "yes", "Remove");
      yes.onclick = async () => {
        await apiDelete(link.id);
        state.links = state.links.filter((l) => l.id !== link.id);
        delete ui.confirmingDelete[link.id];
        render();
      };
      const no = el("button", null, "Cancel");
      no.onclick = () => { delete ui.confirmingDelete[link.id]; render(); };
      cd.append(yes, no);
      rr.appendChild(cd);
    } else {
      const rl = el("button", "removelink", "Remove");
      rl.onclick = () => { ui.confirmingDelete[link.id] = true; render(); };
      rr.appendChild(rl);
    }
    body.appendChild(rr);
  }

  li.appendChild(body);
  return li;
}

// ---- render ----
function render() {
  renderToolbar();
  const list = $("list");
  const count = $("count");
  list.innerHTML = "";

  const loadingCards = state.links.filter((l) => l.loading);
  const vis = visibleLinks(state.links, state);
  // keep optimistic loading cards visible on top regardless of filters
  const shown = [...loadingCards.filter((l) => !vis.includes(l)), ...vis];

  const noun = state.view === "list" ? "in your reading list" : "links";
  const realCount = vis.length;
  count.textContent = realCount + " " + (realCount === 1 ? noun.replace("links", "link") : noun);

  if (shown.length === 0) {
    const e = el("li", "empty");
    if (state.q || state.tagFilters.length) {
      const bits = [];
      if (state.q) bits.push("“" + state.q + "”");
      state.tagFilters.forEach((t) => bits.push("#" + t));
      e.innerHTML = "No links match <b>" + bits.join(" + ") + "</b>. Try fewer words or clearing a filter.";
    } else if (state.view === "list") {
      e.innerHTML = "Your reading list is empty. Add links with <b>＋ Reading list</b>.";
    } else {
      e.textContent = "No links saved yet. Paste a link above and press Save.";
    }
    list.appendChild(e);
    return;
  }

  shown.forEach((link) => list.appendChild(renderCard(link)));
}

// ---- save flow (SCN-001, SCN-006, SCN-008) ----
$("saver").addEventListener("submit", async (e) => {
  e.preventDefault();
  const urlEl = $("url");
  const raw = urlEl.value.trim();
  showSaveMsg("", "");
  if (!raw) { showSaveMsg("err", "Please paste a link first."); return; }

  const saveBtn = $("saveBtn");
  saveBtn.disabled = true;

  // optimistic loading card
  const tempId = "temp-" + Date.now();
  const temp = { id: tempId, url: /^https?:\/\//i.test(raw) ? raw : "https://" + raw, host: hostOf(raw), loading: true, tags: [], savedAt: Date.now() };
  state.links.push(temp);
  urlEl.value = "";
  render();

  const { status, data } = await apiCreate(raw);
  state.links = state.links.filter((l) => l.id !== tempId);

  if (status === 201 && data.link) {
    replaceLink(data.link);
    render();
  } else if (status === 409 && data.link) {
    replaceLink(data.link);
    // jump to the existing one
    state.q = ""; state.tagFilters = []; state.view = "all";
    $("search").value = ""; $("clr").style.display = "none";
    showSaveMsg("dup", "You've already saved this link — jumping to it below.");
    ui.flashId = data.link.id;
    render();
    const node = document.querySelector(`[data-id="${data.link.id}"]`);
    if (node) node.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => { ui.flashId = null; }, 1600);
  } else {
    urlEl.value = raw; // preserve for correction
    showSaveMsg("err", (data && data.message) || "That doesn't look like a web address. Check the link and try again.");
    render();
  }
  saveBtn.disabled = false;
  urlEl.focus();
});

// ---- search (SCN-005) ----
const searchEl = $("search");
const clr = $("clr");
searchEl.addEventListener("input", () => {
  state.q = searchEl.value;
  clr.style.display = searchEl.value ? "block" : "none";
  render();
});
clr.addEventListener("click", () => {
  searchEl.value = ""; state.q = ""; clr.style.display = "none"; searchEl.focus(); render();
});

// ---- boot ----
(async function boot() {
  try {
    state.links = await apiGet();
  } catch (e) {
    state.links = [];
  }
  render();
  document.body.setAttribute("data-harness-ready", "true");
})();
