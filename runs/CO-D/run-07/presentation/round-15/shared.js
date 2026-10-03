(function () {
  const MODE = window.EDIT_MODE || "a"; // a = edit later (button), b = review before save, c = tap-to-edit inline

  // --- Simulated page-detail lookup (prototype only). Stands in for the app
  //     reading a page's real title / site / description / icon / thumbnail. ---
  const KNOWN = {
    "nasa.gov/webb": {
      title: "NASA's James Webb Space Telescope | Home — NASA",
      site: "nasa.gov",
      desc: "The largest, most powerful space telescope ever built, revealing the universe in infrared light.",
      c1: "#0b3d91", c2: "#2f6df6", letter: "N"
    },
    "developer.mozilla.org/css-grid": {
      title: "CSS Grid Layout — MDN Web Docs",
      site: "developer.mozilla.org",
      desc: "A complete guide to CSS Grid: rows, columns, areas, and alignment, with examples.",
      c1: "#111827", c2: "#4b5563", letter: "M"
    },
    "recipes.example.com/ramen": {
      title: "Rich Tonkotsu Ramen from Scratch — Recipes",
      site: "recipes.example.com",
      desc: "A weekend project: 12-hour pork bone broth, homemade tare, and springy noodles.",
      c1: "#b45309", c2: "#f59e0b", letter: "R"
    }
  };

  function hashColor(s) {
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffff;
    const c = "#" + ((h | 0x404040) & 0x9f9f9f).toString(16).padStart(6, "0");
    return c;
  }
  function thumbSVG(site, c1, c2) {
    const svg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='320' height='224'>" +
      "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
      "<stop offset='0' stop-color='" + c1 + "'/><stop offset='1' stop-color='" + c2 + "'/>" +
      "</linearGradient></defs>" +
      "<rect width='320' height='224' fill='url(#g)'/>" +
      "<rect x='0' y='168' width='320' height='56' fill='rgba(0,0,0,0.18)'/>" +
      "<text x='22' y='104' font-family='sans-serif' font-size='34' font-weight='700' fill='rgba(255,255,255,0.96)'>" + site + "</text>" +
      "</svg>";
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }
  function favSVG(letter, c1) {
    const svg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'>" +
      "<rect width='32' height='32' rx='7' fill='" + c1 + "'/>" +
      "<text x='16' y='22' text-anchor='middle' font-family='sans-serif' font-size='18' font-weight='700' fill='#fff'>" + letter + "</text>" +
      "</svg>";
    return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
  }

  function lookup(url) {
    const clean = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
    for (const key in KNOWN) {
      if (clean.toLowerCase().startsWith(key.toLowerCase())) {
        const k = KNOWN[key];
        return { url, title: k.title, site: k.site, desc: k.desc,
                 thumb: thumbSVG(k.site, k.c1, k.c2), fav: favSVG(k.letter, k.c1) };
      }
    }
    const host = clean.split("/")[0];
    const path = clean.split("/").slice(1).join("/");
    let t = path ? decodeURIComponent(path.split(/[/?#]/)[0]).replace(/[-_]+/g, " ").replace(/\.\w+$/, "").trim() : host;
    t = t ? t.replace(/\b\w/g, c => c.toUpperCase()) : host;
    const col = hashColor(host);
    return { url, title: t || host, site: host, desc: "",
             thumb: thumbSVG(host, col, "#8894a8"), fav: favSVG((host[0] || "?").toUpperCase(), col) };
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const listEl = document.getElementById("list");
  const emptyEl = document.getElementById("empty");
  const input = document.getElementById("url");
  const btn = document.getElementById("saveBtn");
  const stage = document.getElementById("stage"); // where preview/loading go (mode b)

  function refreshEmpty() { emptyEl.style.display = listEl.children.length ? "none" : "block"; }
  function savedLabel() {
    const d = new Date();
    return "Saved · " + d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function cardHTML(m, savedText) {
    return (
      '<div class="thumb"><img alt="" src="' + m.thumb + '"></div>' +
      '<div class="card-body">' +
        '<div class="card-title" data-role="title">' + esc(m.title) + '</div>' +
        '<div class="card-site"><img alt="" src="' + m.fav + '"><span>' + esc(m.site) + '</span></div>' +
        '<p class="card-desc" data-role="desc">' + esc(m.desc || "No description found on the page.") + '</p>' +
        '<div class="card-url">' + esc(m.url) + '</div>' +
        '<div class="card-meta">' + (savedText || savedLabel()) + '</div>' +
        actionsHTML() +
      '</div>'
    );
  }
  function actionsHTML() {
    if (MODE === "a") return '<div class="card-actions"><button class="btn small secondary" data-act="edit">Edit</button></div>';
    return ""; // mode b: edit happens before saving; mode c: click the text directly
  }

  function addCard(m, savedText) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = cardHTML(m, savedText);
    if (MODE === "c") makeInlineEditable(card);
    if (MODE === "a") wireEditButton(card, m);
    listEl.prepend(card);
    refreshEmpty();
    return card;
  }

  // ---- MODE A: explicit Edit button toggles editable fields on the card ----
  function wireEditButton(card, m) {
    card.querySelector('[data-act="edit"]').addEventListener("click", () => {
      const titleEl = card.querySelector('[data-role="title"]');
      const descEl = card.querySelector('[data-role="desc"]');
      const t = titleEl.textContent, d = descEl.textContent;
      const body = card.querySelector(".card-body");
      const editZone = document.createElement("div");
      editZone.innerHTML =
        '<div class="tag-hint">Fix anything the page filled in wrong:</div>' +
        '<input class="edit-field" data-e="title" value="' + esc(t) + '">' +
        '<textarea class="edit-field" data-e="desc">' + esc(d) + '</textarea>' +
        '<div class="card-actions"><button class="btn small" data-e="ok">Save changes</button>' +
        '<button class="btn small secondary" data-e="cancel">Cancel</button></div>';
      titleEl.style.display = "none"; descEl.style.display = "none";
      card.querySelector('[data-act="edit"]').parentElement.style.display = "none";
      body.appendChild(editZone);
      editZone.querySelector('[data-e="ok"]').addEventListener("click", () => {
        titleEl.textContent = editZone.querySelector('[data-e="title"]').value;
        descEl.textContent = editZone.querySelector('[data-e="desc"]').value;
        finish();
      });
      editZone.querySelector('[data-e="cancel"]').addEventListener("click", finish);
      function finish() {
        titleEl.style.display = ""; descEl.style.display = "";
        card.querySelector('[data-act="edit"]').parentElement.style.display = "";
        editZone.remove();
      }
    });
  }

  // ---- MODE C: click the title/description text itself to edit in place ----
  function makeInlineEditable(card) {
    ["title", "desc"].forEach(role => {
      const el = card.querySelector('[data-role="' + role + '"]');
      el.classList.add("editable");
      el.title = "Click to edit";
      el.addEventListener("click", () => {
        if (el.dataset.editing) return;
        el.dataset.editing = "1";
        const cur = el.textContent;
        const field = document.createElement(role === "desc" ? "textarea" : "input");
        field.className = "edit-field";
        field.value = cur;
        el.replaceWith(field);
        field.focus();
        const commit = () => {
          const div = document.createElement(role === "desc" ? "p" : "div");
          div.className = role === "desc" ? "card-desc" : "card-title";
          div.dataset.role = role;
          div.textContent = field.value || cur;
          field.replaceWith(div);
          div.classList.add("editable");
          div.title = "Click to edit";
          div.addEventListener("click", () => makeInlineEditableOne(div, role));
        };
        field.addEventListener("blur", commit);
        field.addEventListener("keydown", e => { if (e.key === "Enter" && role !== "desc") field.blur(); });
      });
    });
  }
  function makeInlineEditableOne(div) { // rebind after commit
    const card = div.closest(".card");
    makeInlineEditable(card);
    div.click();
  }

  // ---- SAVE ----
  function save() {
    const url = input.value.trim();
    if (!url) { input.focus(); return; }
    btn.disabled = true;

    if (MODE === "b") {
      // review-before-save: show editable preview in the stage, commit on confirm
      stage.innerHTML = '<div class="preview"><div class="plabel">Fetching page details…</div>' +
        '<div class="skeleton w70"></div><div class="skeleton w90"></div><div class="skeleton w40"></div></div>';
      setTimeout(() => {
        const m = lookup(url);
        stage.innerHTML =
          '<div class="preview"><div class="plabel">Check the details, adjust if needed, then Save</div>' +
          '<div class="card" style="animation:none;margin:0 0 10px;">' +
            '<div class="thumb"><img alt="" src="' + m.thumb + '"></div>' +
            '<div class="card-body">' +
              '<input class="edit-field" data-p="title" value="' + esc(m.title) + '">' +
              '<div class="card-site"><img alt="" src="' + m.fav + '"><span>' + esc(m.site) + '</span></div>' +
              '<textarea class="edit-field" data-p="desc">' + esc(m.desc || "") + '</textarea>' +
              '<div class="card-url">' + esc(m.url) + '</div>' +
            '</div></div>' +
          '<div class="card-actions"><button class="btn" data-p="ok">Save</button>' +
          '<button class="btn secondary" data-p="cancel">Cancel</button></div></div>';
        stage.querySelector('[data-p="ok"]').addEventListener("click", () => {
          m.title = stage.querySelector('[data-p="title"]').value;
          m.desc = stage.querySelector('[data-p="desc"]').value;
          stage.innerHTML = "";
          addCard(m);
          input.value = ""; btn.disabled = false; input.focus();
        });
        stage.querySelector('[data-p="cancel"]').addEventListener("click", () => {
          stage.innerHTML = ""; btn.disabled = false; input.focus();
        });
      }, 850);
      return;
    }

    // modes a & c: one-step save with a brief loading card
    const card = document.createElement("div");
    card.className = "card loading";
    card.innerHTML = '<div class="thumb"></div><div class="card-body"><div class="skeleton w70"></div><div class="skeleton w40"></div><div class="skeleton w90"></div></div>';
    listEl.prepend(card);
    refreshEmpty();
    setTimeout(() => {
      const m = lookup(url);
      card.remove();
      addCard(m);
      input.value = ""; btn.disabled = false; input.focus();
    }, 850);
  }

  btn.addEventListener("click", save);
  input.addEventListener("keydown", e => { if (e.key === "Enter") save(); });

  // Pre-seed one saved bookmark whose auto-filled title is a bit off, so the
  // client can immediately try correcting it (modes a & c). Mode b edits during
  // save, so it also starts with this item for a like-for-like collection view.
  const seed = lookup("https://nasa.gov/webb");
  addCard(seed, "Saved · Aug 2, 2026");

  refreshEmpty();
  document.body.setAttribute("data-harness-ready", "true");
})();
