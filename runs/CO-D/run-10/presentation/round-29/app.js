const $ = (selector) => document.querySelector(selector);

const backdrop = $("#backdrop");
const dialog = $("#saveDialog");
const urlStep = $("#urlStep");
const loadingStep = $("#loadingStep");
const previewStep = $("#previewStep");
const urlInput = $("#urlInput");
const sampleAddress = "https://www.atlasobscura.com/articles/ancient-libraries";
const pageParams = new URLSearchParams(window.location.search);
const pageState = pageParams.get("state");
let hasExistingBookmark = pageState === "duplicate";
let editingDuplicate = false;
let editingDetails = false;
let labels = [];
const existingLabels = ["architecture", "Reading", "History", "Design research"];
let pendingReadLater = false;

function openDialog() {
  backdrop.hidden = false;
  dialog.hidden = false;
  urlStep.hidden = false;
  loadingStep.hidden = true;
  previewStep.hidden = true;
  requestAnimationFrame(() => urlInput.focus());
}

function closeDialog() {
  backdrop.hidden = true;
  dialog.hidden = true;
}

function normaliseUrl(value) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function setPageDetails(value) {
  let domain = "atlasobscura.com";
  try {
    domain = new URL(normaliseUrl(value)).hostname.replace(/^www\./, "");
  } catch (_) {}

  const knownSample = domain.includes("atlasobscura");
  const title = knownSample
    ? "The Enduring Mystery of the Ancient Library"
    : `A page worth returning to on ${domain}`;
  const description = knownSample
    ? "What the world’s vanished collections can teach us about preserving knowledge."
    : "A saved page, with its key details gathered automatically.";
  const initial = domain.charAt(0).toUpperCase();

  $("#previewDomain").textContent = domain;
  $("#previewTitle").value = title;
  $("#previewDescription").value = description;
  $("#previewDomain").dataset.initial = initial;
}

function showExistingLibrary() {
  $("#emptyState").hidden = true;
  $("#library").hidden = false;
  $("#sideCount").textContent = "1";
  $("#cardTitle").textContent = "A field guide to ancient libraries";
  $("#cardDescription").textContent = "Ideas about lost collections and why preserving knowledge matters.";
}

function makeLibraryCard({ theme, imageText, domain, initial, title, description, labels: cardLabelList, saved }) {
  const card = document.createElement("article");
  card.className = "bookmark-card";
  card.dataset.labels = cardLabelList.join(",");
  card.innerHTML = `
    <div class="bookmark-image ${theme}"><span>${imageText}</span></div>
    <div class="bookmark-body">
      <div class="source-line"><span class="favicon">${initial}</span><span>${domain}</span></div>
      <h2>${title}</h2>
      <p>${description}</p>
      <div class="card-labels">${cardLabelList.map((label) => `<button class="card-label" data-filter="${label}">${label}</button>`).join("")}</div>
      <p class="saved-line">${saved}</p>
    </div>`;
  return card;
}

function applySearch(query) {
  const cleaned = query.trim().toLowerCase();
  let visible = 0;
  document.querySelectorAll(".bookmark-card").forEach((card) => {
    const title = card.querySelector("h2").textContent.toLowerCase();
    const description = card.querySelector(".bookmark-body > p:not(.saved-line):not(.match-reason)").textContent.toLowerCase();
    const address = card.querySelector(".source-line span:last-child").textContent.toLowerCase();
    const note = (card.dataset.note || "").toLowerCase();
    const titleMatch = title.includes(cleaned);
    const descriptionMatch = description.includes(cleaned);
    const addressMatch = address.includes(cleaned);
    const noteMatch = note.includes(cleaned);
    const matches = !cleaned || titleMatch || descriptionMatch || addressMatch || noteMatch;
    card.hidden = !matches;
    if (matches) visible += 1;
    let reason = card.querySelector(".match-reason");
    if (!reason) {
      reason = document.createElement("p");
      reason.className = "match-reason";
      card.querySelector(".bookmark-body").insertBefore(reason, card.querySelector(".saved-line"));
    }
    const nonTitleReason = noteMatch
      ? "Matched your personal note"
      : descriptionMatch
        ? "Matched the description"
        : addressMatch
          ? "Matched the web address"
          : "";
    reason.textContent = nonTitleReason;
    reason.hidden = !(cleaned && !titleMatch && nonTitleReason);
  });
  $("#libraryTitle").textContent = cleaned ? "Search results" : "All bookmarks";
  $(".result-count").textContent = `${visible} ${visible === 1 ? "bookmark" : "bookmarks"}`;
  $("#clearSearch").hidden = !cleaned;
}

function showSearchLibrary(version) {
  showFilterLibrary();
  const cards = [...document.querySelectorAll(".bookmark-card")];
  cards[0].dataset.note = "Use this for the museum renovation ideas. Museum layouts. Natural lighting references.";
  cards[1].dataset.note = "Read this before the summer coast trip.";
  cards[2].dataset.note = "Public space examples for the neighborhood project.";
  cards[3].dataset.note = "A reference for evening reading habits.";
  $("#searchPanel").hidden = false;
  $("#searchSubmit").hidden = version !== "b";
  $("#searchHint").textContent = version === "a" ? "Results update as you type" : "Type your words, then search";
  if (version === "a") {
    $("#searchInput").addEventListener("input", (event) => applySearch(event.currentTarget.value));
  }
  const startingQuery = pageParams.get("query") || "";
  if (startingQuery) {
    $("#searchInput").value = startingQuery;
    applySearch(startingQuery);
  }
  requestAnimationFrame(() => $("#searchInput").focus());
}

function updateLaterCount() {
  const count = [...document.querySelectorAll(".bookmark-card")]
    .filter((card) => card.dataset.later === "true").length;
  $("#laterCount").textContent = String(count);
}

function applyLaterFilter() {
  let visible = 0;
  document.querySelectorAll(".bookmark-card").forEach((card) => {
    const matches = card.dataset.later === "true";
    card.hidden = !matches;
    if (matches) visible += 1;
  });
  $("#libraryTitle").textContent = "Read later";
  $(".result-count").textContent = `${visible} ${visible === 1 ? "bookmark" : "bookmarks"}`;
  $("#allBookmarks").classList.remove("active");
  $("#laterNav").classList.add("selected");
}

function showLaterDetails() {
  editingDetails = true;
  backdrop.hidden = false;
  dialog.hidden = false;
  urlStep.hidden = true;
  loadingStep.hidden = true;
  previewStep.hidden = false;
  $("#previewEyebrow").textContent = "Bookmark details";
  $("#previewHeading").textContent = "Choose what to read next";
  $("#duplicateNotice").hidden = true;
  $("#previewTitle").value = $("#cardTitle").textContent;
  $("#previewDescription").value = $("#cardDescription").textContent;
  $("#laterEditor").hidden = false;
  $("#saveBookmark").textContent = "Save changes";
}

function showLaterLibrary(version) {
  showFilterLibrary();
  $("#laterNav").hidden = false;
  document.querySelectorAll(".bookmark-card").forEach((card) => { card.dataset.later = "false"; });
  if (version === "a") {
    document.querySelectorAll(".bookmark-card").forEach((card) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "later-toggle";
      button.setAttribute("aria-label", `Add ${card.querySelector("h2").textContent} to Read later`);
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"></circle><path d="M12 8.5V12l2.7 1.7"></path></svg>';
      button.addEventListener("click", () => {
        const selected = card.dataset.later !== "true";
        card.dataset.later = String(selected);
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-label", `${selected ? "Remove" : "Add"} ${card.querySelector("h2").textContent} ${selected ? "from" : "to"} Read later`);
        updateLaterCount();
        const toast = $("#toast");
        toast.querySelector("span:last-child").textContent = selected ? "Added to Read later" : "Removed from Read later";
        toast.hidden = false;
        setTimeout(() => { toast.hidden = true; }, 2500);
      });
      card.prepend(button);
    });
  } else {
    showLaterDetails();
  }
  $("#laterNav").addEventListener("click", applyLaterFilter);
  updateLaterCount();
}

function applyLabelFilter(label) {
  const cards = [...document.querySelectorAll(".bookmark-card")];
  let visible = 0;
  cards.forEach((card) => {
    const matches = !label || card.dataset.labels.split(",").includes(label);
    card.hidden = !matches;
    if (matches) visible += 1;
  });
  $("#libraryTitle").textContent = label || "All bookmarks";
  $(".result-count").textContent = `${visible} ${visible === 1 ? "bookmark" : "bookmarks"}`;
  $("#allBookmarks").classList.toggle("active", !label);
  $("#laterNav").classList.remove("selected");
  document.querySelectorAll(".label-nav-item").forEach((item) => item.classList.toggle("selected", item.dataset.filter === label));
}

function showFilterLibrary() {
  showExistingLibrary();
  $("#labelNav").hidden = false;
  $("#sideCount").textContent = "4";
  const firstCard = $(".bookmark-card");
  firstCard.dataset.labels = "architecture,History";
  const firstLabels = $("#cardLabels");
  firstLabels.innerHTML = '<button class="card-label" data-filter="architecture">architecture</button><button class="card-label" data-filter="History">History</button>';
  firstLabels.hidden = false;
  const grid = $("#bookmarkGrid");
  [
    { theme: "ocean", imageText: "BLUE MIND", domain: "aeon.co", initial: "A", title: "Why water makes us feel at home", description: "On coastlines, attention, and the restorative pull of blue spaces.", labels: ["Reading"], saved: "Saved yesterday" },
    { theme: "paper", imageText: "OPEN CITY", domain: "designobserver.com", initial: "D", title: "The buildings that invite us in", description: "How thresholds, benches, and generous edges make cities more humane.", labels: ["architecture", "Reading"], saved: "Saved 4 days ago" },
    { theme: "night", imageText: "AFTER DARK", domain: "publicdomainreview.org", initial: "P", title: "A brief history of reading at night", description: "From candlelit manuscripts to the pools of light beside our beds.", labels: ["History"], saved: "Saved last week" }
  ].forEach((details) => grid.appendChild(makeLibraryCard(details)));
  applyLabelFilter("");
  document.querySelectorAll(".card-label, .label-nav-item").forEach((button) => {
    button.addEventListener("click", () => applyLabelFilter(button.dataset.filter));
  });
  $("#allBookmarks").addEventListener("click", (event) => {
    event.preventDefault();
    applyLabelFilter("");
  });
  applyLabelFilter(pageParams.get("filter") || "");
}

function renderLabels() {
  const selected = $("#selectedLabels");
  selected.innerHTML = "";
  labels.forEach((label) => {
    const chip = document.createElement("span");
    chip.className = "label-chip";
    chip.innerHTML = `<span>${label}</span><button type="button" aria-label="Remove ${label}">×</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      labels = labels.filter((item) => item !== label);
      renderLabels();
    });
    selected.appendChild(chip);
  });
}

function addLabel(value) {
  const requested = value.trim();
  const existing = existingLabels.find((item) => item.toLowerCase() === requested.toLowerCase());
  const label = existing || requested;
  if (label && !labels.some((item) => item.toLowerCase() === label.toLowerCase())) {
    labels.push(label);
    renderLabels();
  }
}

function showMatchingLabels(value) {
  const suggestions = $("#labelSuggestions");
  const query = value.trim().toLowerCase();
  const matches = query
    ? existingLabels.filter((label) => label.toLowerCase().includes(query) && !labels.some((chosen) => chosen.toLowerCase() === label.toLowerCase()))
    : [];
  suggestions.innerHTML = "";
  matches.forEach((label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "label-suggestion";
    button.innerHTML = `<span>${label}</span><small>Use existing</small>`;
    button.addEventListener("click", () => {
      addLabel(label);
      $("#labelInput").value = "";
      suggestions.hidden = true;
    });
    suggestions.appendChild(button);
  });
  suggestions.hidden = matches.length === 0;
}

function showLabelEditor(version) {
  editingDetails = true;
  showExistingLibrary();
  backdrop.hidden = false;
  dialog.hidden = false;
  urlStep.hidden = true;
  loadingStep.hidden = true;
  previewStep.hidden = false;
  $("#previewEyebrow").textContent = "Bookmark details";
  $("#previewHeading").textContent = "Make it easy to find again";
  $("#duplicateNotice").hidden = true;
  $("#previewTitle").value = $("#cardTitle").textContent;
  $("#previewDescription").value = $("#cardDescription").textContent;
  $("#labelEditor").hidden = false;
  $("#labelVersionA").hidden = version !== "a";
  $("#labelVersionB").hidden = version !== "b";
  $("#saveBookmark").textContent = "Save changes";
}

function showNoteEditor() {
  editingDetails = true;
  showExistingLibrary();
  backdrop.hidden = false;
  dialog.hidden = false;
  urlStep.hidden = true;
  loadingStep.hidden = true;
  previewStep.hidden = false;
  $("#previewEyebrow").textContent = "Bookmark details";
  $("#previewHeading").textContent = "Add your own context";
  $("#duplicateNotice").hidden = true;
  $("#previewTitle").value = $("#cardTitle").textContent;
  $("#previewDescription").value = $("#cardDescription").textContent;
  $("#noteEditor").hidden = false;
  $("#saveBookmark").textContent = "Save changes";
  requestAnimationFrame(() => $("#noteInput").focus());
}

function openSavedNote() {
  const savedNote = $(".bookmark-card").dataset.note;
  showNoteEditor();
  $("#previewHeading").textContent = "Bookmark details";
  $("#noteInput").value = savedNote;
}

function showNoteLibrary(version) {
  showExistingLibrary();
  const savedNote = "Use this for the museum renovation ideas.";
  $(".bookmark-card").dataset.note = savedNote;
  const cardLabels = $("#cardLabels");
  cardLabels.innerHTML = '<button class="card-label">architecture</button>';
  cardLabels.hidden = false;
  if (version === "a") $("#cardAction").hidden = false;
  if (version === "b") $("#openDetailsButton").hidden = false;
}

function showNoteFormatting(version) {
  editingDetails = true;
  showExistingLibrary();
  backdrop.hidden = false;
  dialog.hidden = false;
  urlStep.hidden = true;
  loadingStep.hidden = true;
  previewStep.hidden = false;
  $("#previewEyebrow").textContent = "Bookmark details";
  $("#previewHeading").textContent = "Add your own context";
  $("#duplicateNotice").hidden = true;
  $("#previewTitle").value = $("#cardTitle").textContent;
  $("#previewDescription").value = $("#cardDescription").textContent;
  $("#noteEditor").hidden = false;
  $("#noteInput").hidden = true;
  $("#richNoteEditor").hidden = version !== "a";
  $("#markdownNoteEditor").hidden = version !== "b";
  $("#saveBookmark").textContent = "Save changes";
  if (version === "a") requestAnimationFrame(() => $("#richNoteInput").focus());
}

function showFormattedNoteView() {
  showNoteFormatting("a");
  $("#previewHeading").textContent = "Bookmark details";
  $("#richNoteInput").innerHTML = "<p>Use this for the museum renovation ideas.</p><p>Things to revisit:</p><ul><li>Museum layouts</li><li>Natural lighting references</li></ul>";
}

$("#emptyAdd").addEventListener("click", openDialog);
$("#headerAdd").addEventListener("click", openDialog);
$("#closeDialog").addEventListener("click", closeDialog);
backdrop.addEventListener("click", closeDialog);

$("#sampleUrl").addEventListener("click", () => {
  urlInput.value = sampleAddress;
  urlInput.focus();
});

$("#urlForm").addEventListener("submit", (event) => {
  event.preventDefault();
  setPageDetails(urlInput.value);
  let submittedDomain = "";
  let submittedPath = "";
  try {
    const submitted = new URL(normaliseUrl(urlInput.value));
    submittedDomain = submitted.hostname.replace(/^www\./, "");
    submittedPath = submitted.pathname.replace(/\/$/, "");
  } catch (_) {}
  editingDuplicate = hasExistingBookmark && submittedDomain === "atlasobscura.com" && submittedPath === "/articles/ancient-libraries";

  $("#previewEyebrow").textContent = editingDuplicate ? "Already in your library" : "Ready to save";
  $("#previewHeading").textContent = editingDuplicate ? "Edit your existing bookmark" : "Here’s what we found";
  $("#duplicateNotice").hidden = !editingDuplicate;
  $("#saveBookmark").textContent = editingDuplicate ? "Update bookmark" : "Save bookmark";
  if (editingDuplicate) {
    $("#previewTitle").value = $("#cardTitle").textContent;
    $("#previewDescription").value = $("#cardDescription").textContent;
  }
  urlStep.hidden = true;
  loadingStep.hidden = false;
  setTimeout(() => {
    loadingStep.hidden = true;
    previewStep.hidden = false;
  }, 850);
});

$("#startOver").addEventListener("click", () => {
  previewStep.hidden = true;
  urlStep.hidden = false;
  urlInput.focus();
});

$("#labelInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addLabel(event.currentTarget.value);
    event.currentTarget.value = "";
  }
});

$("#labelInput").addEventListener("input", (event) => {
  showMatchingLabels(event.currentTarget.value);
});

$("#openLabelPicker").addEventListener("click", () => {
  $("#labelPicker").hidden = !$("#labelPicker").hidden;
  if (!$("#labelPicker").hidden) $("#pickerInput").focus();
});

document.querySelectorAll(".suggested-label").forEach((button) => {
  button.addEventListener("click", () => addLabel(button.dataset.label));
});

$("#createLabel").addEventListener("click", () => {
  addLabel($("#pickerInput").value);
  $("#pickerInput").value = "";
});

$("#cardMenuButton").addEventListener("click", () => {
  $("#cardMenu").hidden = !$("#cardMenu").hidden;
});
$("#openDetailsMenu").addEventListener("click", openSavedNote);
$("#openDetailsButton").addEventListener("click", openSavedNote);

$("#bulletButton").addEventListener("click", () => {
  $("#richNoteInput").focus();
  document.execCommand("insertUnorderedList", false, null);
  $("#bulletButton").classList.add("active");
});

$("#showNotePreview").addEventListener("click", () => {
  $("#markdownPreview").hidden = false;
});

$("#laterSwitch").addEventListener("click", () => {
  pendingReadLater = !pendingReadLater;
  $("#laterSwitch").setAttribute("aria-checked", String(pendingReadLater));
});

$("#searchForm").addEventListener("submit", (event) => {
  event.preventDefault();
  applySearch($("#searchInput").value);
});

$("#clearSearch").addEventListener("click", () => {
  $("#searchInput").value = "";
  applySearch("");
  $("#searchInput").focus();
});

$("#saveBookmark").addEventListener("click", () => {
  $("#cardDomain").textContent = $("#previewDomain").textContent;
  $("#cardFavicon").textContent = $("#previewDomain").dataset.initial || "•";
  $("#cardTitle").textContent = $("#previewTitle").value.trim() || "Untitled bookmark";
  $("#cardDescription").textContent = $("#previewDescription").value.trim();
  $(".bookmark-card").dataset.note = $("#noteInput").value.trim();
  if (!$("#laterEditor").hidden) {
    $(".bookmark-card").dataset.later = String(pendingReadLater);
    updateLaterCount();
  }
  const cardLabels = $("#cardLabels");
  cardLabels.innerHTML = labels.map((label) => `<span class="card-label">${label}</span>`).join("");
  cardLabels.hidden = labels.length === 0;
  closeDialog();
  $("#emptyState").hidden = true;
  $("#library").hidden = false;
  $("#sideCount").textContent = "1";
  const toast = $("#toast");
  toast.querySelector("span:last-child").textContent = editingDuplicate
    ? "Bookmark updated — no duplicate created"
    : editingDetails ? "Bookmark details updated" : "Bookmark saved to your library";
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 3500);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !dialog.hidden) closeDialog();
});

if (pageState === "preview") {
  backdrop.hidden = false;
  dialog.hidden = false;
  urlStep.hidden = true;
  loadingStep.hidden = true;
  previewStep.hidden = false;
}

if (pageState === "duplicate") {
  showExistingLibrary();
}

if (pageState === "labels-a") showLabelEditor("a");
if (pageState === "labels-b") showLabelEditor("b");
if (pageState === "label-filter") showFilterLibrary();
if (pageState === "notes") showNoteEditor();
if (pageState === "note-open-a") showNoteLibrary("a");
if (pageState === "note-open-b") showNoteLibrary("b");
if (pageState === "note-view") {
  showNoteLibrary("b");
  openSavedNote();
}
if (pageState === "note-format-a") showNoteFormatting("a");
if (pageState === "note-format-b") showNoteFormatting("b");
if (pageState === "formatted-note-view") showFormattedNoteView();
if (pageState === "search-a") showSearchLibrary("a");
if (pageState === "search-b") showSearchLibrary("b");
if (pageState === "later-a") showLaterLibrary("a");
if (pageState === "later-b") showLaterLibrary("b");
