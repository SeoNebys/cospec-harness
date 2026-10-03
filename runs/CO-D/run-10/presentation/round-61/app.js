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
let inLaterView = false;
let fetchFailed = false;
let deleteStartedFromDetails = false;
let bulkVersion = "a";
let bulkDeletePending = false;
let pendingBulkDeleteCards = [];

function showToast(message) {
  const toast = $("#toast");
  toast.querySelector("span:last-child").textContent = message;
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 3000);
}

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

function isUsableWebAddress(value) {
  try {
    const candidate = new URL(normaliseUrl(value.trim()));
    return ["http:", "https:"].includes(candidate.protocol) && candidate.hostname.includes(".") && !candidate.hostname.includes(" ");
  } catch (_) {
    return false;
  }
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
  card.dataset.savedOrder = String({ "Saved yesterday": 3, "Saved 4 days ago": 2, "Saved last week": 1 }[saved] || 0);
  card.innerHTML = `
    <a class="bookmark-link" href="destination.html" target="_blank" aria-label="Open ${title}"><div class="bookmark-image ${theme}"><span>${imageText}</span></div></a>
    <div class="bookmark-body">
      <div class="source-line"><span class="favicon">${initial}</span><span>${domain}</span></div>
      <h2><a class="bookmark-title-link" href="destination.html" target="_blank">${title}</a></h2>
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
    const archived = card.dataset.archived === "true";
    const matches = !archived && (!cleaned || titleMatch || descriptionMatch || addressMatch || noteMatch);
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
  $("#noResults").hidden = !(cleaned && visible === 0);
  $("#emptyQuery").textContent = query.trim();
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

function showArchiveSearch() {
  showSearchLibrary("a");
  const archivedCard = $(".bookmark-card");
  archivedCard.dataset.archived = "true";
  $("#archiveNav").hidden = false;
  $("#archiveCount").textContent = "1";
  $("#sideCount").textContent = "3";
  applySearch(pageParams.get("query") || "");
}

function updateLaterCount() {
  const count = [...document.querySelectorAll(".bookmark-card")]
    .filter((card) => card.dataset.later === "true").length;
  $("#laterCount").textContent = String(count);
}

function applyLaterFilter() {
  inLaterView = true;
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
  $("#emptyLater").hidden = visible !== 0;
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
        const wasInLaterView = inLaterView;
        const selected = card.dataset.later !== "true";
        card.dataset.later = String(selected);
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-label", selected
          ? `Mark ${card.querySelector("h2").textContent} as read`
          : `Add ${card.querySelector("h2").textContent} to Read later`);
        updateLaterCount();
        if (wasInLaterView && !selected) {
          card.hidden = true;
          const visible = [...document.querySelectorAll(".bookmark-card")].filter((item) => !item.hidden).length;
          $(".result-count").textContent = `${visible} ${visible === 1 ? "bookmark" : "bookmarks"}`;
          $("#emptyLater").hidden = visible !== 0;
        }
        const toast = $("#toast");
        toast.querySelector("span:last-child").textContent = selected
          ? "Added to Read later"
          : wasInLaterView ? "Marked as read and removed from the list" : "Removed from Read later";
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

function showPreparedLaterLibrary() {
  showLaterLibrary("a");
  const cards = [...document.querySelectorAll(".bookmark-card")];
  [cards[0], cards[2]].forEach((card) => {
    card.dataset.later = "true";
    const button = card.querySelector(".later-toggle");
    button.classList.add("selected");
    button.setAttribute("aria-label", `Mark ${card.querySelector("h2").textContent} as read`);
  });
  updateLaterCount();
}

function showActiveLaterView() {
  showPreparedLaterLibrary();
  applyLaterFilter();
}

function showEmptyLaterView() {
  showLaterLibrary("a");
  applyLaterFilter();
}

function showLongContentLibrary() {
  showFilterLibrary();
  const first = $(".bookmark-card");
  const longTitle = "A beautifully illustrated and unexpectedly detailed field guide to the ancient libraries, reading rooms, archives, and forgotten collections that shaped how we remember the world";
  const longDescription = "A wide-ranging essay about lost collections, public reading rooms, preservation, architecture, and the small design choices that help knowledge survive for the next generation.";
  $("#cardTitle").textContent = longTitle;
  $("#cardTitle").title = longTitle;
  $("#cardDescription").textContent = longDescription;
  $("#cardDescription").title = longDescription;
  const allLabels = ["architecture", "History", "Reading", "Libraries", "Preservation", "Research", "Inspiration"];
  first.dataset.labels = allLabels.join(",");
  const cardLabels = $("#cardLabels");
  cardLabels.innerHTML = allLabels.slice(0, 3).map((label) => `<button class="card-label">${label}</button>`).join("") + '<span class="more-labels">+4 more</span>';
  cardLabels.hidden = false;
}

function sortLibrary(mode) {
  const grid = $("#bookmarkGrid");
  const cards = [...grid.querySelectorAll(".bookmark-card")];
  cards.sort((a, b) => {
    if (mode === "name") return a.querySelector("h2").textContent.localeCompare(b.querySelector("h2").textContent);
    const direction = mode === "oldest" ? 1 : -1;
    return (Number(a.dataset.savedOrder) - Number(b.dataset.savedOrder)) * direction;
  });
  cards.forEach((card) => grid.appendChild(card));
  document.querySelectorAll(".sort-buttons button").forEach((button) => button.classList.toggle("selected", button.dataset.sort === mode));
}

function showSortLibrary(version) {
  showFilterLibrary();
  $("#sortVersionA").hidden = version !== "a";
  $("#sortVersionB").hidden = version !== "b";
  sortLibrary("newest");
}

function visibleBulkCheckboxes() {
  return [...document.querySelectorAll(".bookmark-card")]
    .filter((card) => !card.hidden)
    .map((card) => card.querySelector(".card-select input"));
}

function selectedBulkCards() {
  return [...document.querySelectorAll(".card-select input:checked")]
    .map((checkbox) => checkbox.closest(".bookmark-card"));
}

function bulkLabelChoices() {
  const cardLabels = [...document.querySelectorAll(".bookmark-card")]
    .flatMap((card) => card.dataset.labels.split(","))
    .filter(Boolean);
  return [...new Set([...existingLabels, ...cardLabels])];
}

function applyBulkLabel(value) {
  const cleaned = value.trim();
  if (!cleaned) return;
  const label = bulkLabelChoices().find((item) => item.toLowerCase() === cleaned.toLowerCase()) || cleaned;
  const selected = selectedBulkCards();
  selected.forEach((card) => {
    const current = card.dataset.labels.split(",").filter(Boolean);
    if (!current.some((item) => item.toLowerCase() === label.toLowerCase())) current.push(label);
    card.dataset.labels = current.join(",");
    const container = card.querySelector(".card-labels");
    container.innerHTML = current.map((item) => `<button class="card-label" data-filter="${item}">${item}</button>`).join("");
    container.hidden = false;
  });
  $("#bulkLabelInput").value = "";
  $("#bulkLabelSuggestions").hidden = true;
  $("#bulkLabelMenu").hidden = true;
  showToast(`${label} added to ${selected.length} bookmarks`);
}

function updateBulkLabelSuggestions() {
  const query = $("#bulkLabelInput").value.trim().toLowerCase();
  const suggestions = $("#bulkLabelSuggestions");
  const matches = query ? bulkLabelChoices().filter((label) => label.toLowerCase().includes(query)) : [];
  suggestions.innerHTML = "";
  matches.forEach((label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "label-suggestion";
    button.innerHTML = `<span>${label}</span><small>Already in your library</small>`;
    button.addEventListener("click", () => applyBulkLabel(label));
    suggestions.appendChild(button);
  });
  suggestions.hidden = matches.length === 0;
}

function updateBulkSelection() {
  const checkboxes = [...document.querySelectorAll(".card-select input")];
  const selected = checkboxes.filter((checkbox) => checkbox.checked);
  checkboxes.forEach((checkbox) => checkbox.closest(".bookmark-card").classList.toggle("is-selected", checkbox.checked));
  $("#selectedCount").textContent = `${selected.length} selected`;
  [$("#bulkLabel"), $("#bulkLater"), $("#bulkArchive"), $("#bulkDelete")].forEach((button) => { button.disabled = selected.length === 0; });
  const visible = visibleBulkCheckboxes();
  $("#selectAll").checked = visible.length > 0 && visible.every((checkbox) => checkbox.checked);
  $("#selectAll").indeterminate = visible.some((checkbox) => checkbox.checked) && !$("#selectAll").checked;
  if (bulkVersion === "b") $("#bulkToolbar").hidden = selected.length === 0;
}

function enterSelectionMode() {
  document.querySelectorAll(".card-select").forEach((control) => { control.hidden = false; });
  $("#bulkToolbar").hidden = false;
  $("#startSelection").hidden = true;
  updateBulkSelection();
}

function showBulkLibrary(version) {
  bulkVersion = version;
  showSortLibrary("a");
  $("#laterNav").hidden = false;
  $("#startSelection").hidden = version !== "a";
  document.querySelectorAll(".bookmark-card").forEach((card) => {
    const control = document.createElement("label");
    control.className = "card-select";
    control.hidden = version === "a";
    control.innerHTML = `<input type="checkbox" aria-label="Select ${card.querySelector("h2").textContent}" />`;
    control.querySelector("input").addEventListener("change", updateBulkSelection);
    card.prepend(control);
  });
}

function showBulkSelected() {
  showBulkLibrary("a");
  enterSelectionMode();
  visibleBulkCheckboxes().slice(0, 2).forEach((checkbox) => { checkbox.checked = true; });
  updateBulkSelection();
}

function showBulkAdded() {
  showBulkSelected();
  selectedBulkCards().forEach((card) => { card.dataset.later = "true"; });
  updateLaterCount();
  const toast = $("#toast");
  toast.querySelector("span:last-child").textContent = "2 bookmarks added to Read later";
  toast.hidden = false;
}

function showBulkFiltered() {
  showBulkLibrary("a");
  applyLabelFilter("architecture");
  enterSelectionMode();
}

function showBulkLabelReady() {
  showBulkSelected();
  $("#bulkLabelMenu").hidden = false;
  $("#bulkLabelInput").value = "design";
  updateBulkLabelSuggestions();
}

function showBulkArchiveReady() {
  showBulkSelected();
  $("#archiveNav").hidden = false;
  $("#archiveCount").textContent = "0";
}

function showBulkDeleteReady() {
  showBulkSelected();
  showBulkDeleteConfirmation();
}

function openTransferPanel() {
  $("#emptyState").hidden = true;
  $("#library").hidden = true;
  $("#searchPanel").hidden = true;
  $("#transferPanel").hidden = false;
  $("#libraryTitle").textContent = "Import & export";
  $("#allBookmarks").classList.remove("active");
  $("#laterNav").classList.remove("selected");
  $("#archiveNav").classList.remove("selected");
  $("#transferNav").classList.add("selected");
  $("#libraryToolsMenu").hidden = true;
}

function showTransferVersionA() {
  showFilterLibrary();
  $("#transferNav").hidden = false;
}

function showTransferVersionB() {
  showFilterLibrary();
  $("#libraryTools").hidden = false;
}

function applyLabelFilter(label) {
  inLaterView = false;
  $("#emptyLater").hidden = true;
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

function showLinkLibrary(version) {
  showNoteLibrary("b");
  const target = version === "a" ? "_blank" : "_self";
  document.querySelectorAll(".bookmark-link, .bookmark-title-link").forEach((link) => {
    link.target = target;
  });
}

function showDeleteConfirmation(fromDetails) {
  bulkDeletePending = false;
  deleteStartedFromDetails = fromDetails;
  backdrop.hidden = false;
  dialog.hidden = false;
  urlStep.hidden = true;
  loadingStep.hidden = true;
  previewStep.hidden = true;
  $("#deleteStep").hidden = false;
}

function showBulkDeleteConfirmation() {
  pendingBulkDeleteCards = selectedBulkCards();
  bulkDeletePending = true;
  backdrop.hidden = false;
  dialog.hidden = false;
  urlStep.hidden = true;
  loadingStep.hidden = true;
  previewStep.hidden = true;
  $("#deleteStep").hidden = false;
  $("#deleteHeading").textContent = `Delete ${pendingBulkDeleteCards.length} bookmarks?`;
  $("#deleteCopy").textContent = "This removes their saved titles, descriptions, labels, and personal notes from your library. This cannot be undone.";
  const summary = $("#deleteSummary");
  summary.classList.add("bulk-delete-summary");
  summary.innerHTML = pendingBulkDeleteCards.map((card) => {
    const title = card.querySelector("h2").textContent;
    const domain = card.querySelector(".source-line span:last-child").textContent;
    const initial = card.querySelector(".favicon").textContent;
    return `<div class="bulk-delete-item"><span class="favicon">${initial}</span><div><strong>${title}</strong><small>${domain}</small></div></div>`;
  }).join("");
  $("#keepBookmark").textContent = "Keep bookmarks";
  $("#confirmDelete").textContent = `Delete ${pendingBulkDeleteCards.length} permanently`;
}

function showDeletePrototype(version) {
  showNoteLibrary("b");
  if (version === "a") {
    openSavedNote();
    $("#dangerZone").hidden = false;
  } else {
    $("#cardAction").hidden = false;
    $("#deleteFromMenu").hidden = false;
  }
}

function archiveCurrentBookmark() {
  const card = $(".bookmark-card");
  card.dataset.archived = "true";
  card.hidden = true;
  closeDialog();
  $("#archiveNav").hidden = false;
  $("#archiveCount").textContent = "1";
  $("#sideCount").textContent = "0";
  $(".result-count").textContent = "0 bookmarks";
  $("#emptyAfterArchive").hidden = false;
  const toast = $("#toast");
  toast.querySelector("span:last-child").textContent = "Bookmark moved to Archive";
  toast.hidden = false;
}

function showArchivedBookmark() {
  const card = $(".bookmark-card");
  card.hidden = false;
  $("#emptyAfterArchive").hidden = true;
  $("#libraryTitle").textContent = "Archive";
  $(".result-count").textContent = "1 bookmark";
  $("#allBookmarks").classList.remove("active");
  $("#archiveNav").classList.add("selected");
}

function showRestorePrototype() {
  showNoteLibrary("b");
  const card = $(".bookmark-card");
  card.dataset.archived = "true";
  $("#archiveNav").hidden = false;
  $("#archiveCount").textContent = "1";
  $("#sideCount").textContent = "0";
  showArchivedBookmark();
  $("#restoreBookmark").hidden = false;
}

function showArchivePrototype(version) {
  showNoteLibrary("b");
  $("#archiveNav").hidden = false;
  if (version === "a") {
    openSavedNote();
    $("#archiveZone").hidden = false;
    $("#dangerZone").hidden = false;
  } else {
    $("#cardAction").hidden = false;
    $("#archiveFromMenu").hidden = false;
  }
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
  if (!isUsableWebAddress(urlInput.value)) {
    $("#urlError").hidden = false;
    $(".url-wrap").classList.add("has-error");
    urlInput.focus();
    return;
  }
  $("#urlError").hidden = true;
  $(".url-wrap").classList.remove("has-error");
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
    if (pageState === "fetch-failure") {
      fetchFailed = true;
      $("#previewEyebrow").textContent = "Details unavailable";
      $("#previewHeading").textContent = "We couldn’t read this page";
      $("#fetchNotice").hidden = false;
      $("#previewTitle").value = "";
      $("#previewDescription").value = "";
      $("#previewImage").classList.add("no-preview");
      $("#previewImageLabel").textContent = "NO PREVIEW AVAILABLE";
    }
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
$("#deleteBookmark").addEventListener("click", () => showDeleteConfirmation(true));
$("#deleteFromMenu").addEventListener("click", () => showDeleteConfirmation(false));
$("#keepBookmark").addEventListener("click", () => {
  $("#deleteStep").hidden = true;
  if (bulkDeletePending) {
    closeDialog();
    bulkDeletePending = false;
    return;
  }
  if (deleteStartedFromDetails) {
    previewStep.hidden = false;
  } else {
    closeDialog();
  }
});
$("#confirmDelete").addEventListener("click", () => {
  if (bulkDeletePending) {
    const deletedCount = pendingBulkDeleteCards.length;
    pendingBulkDeleteCards.forEach((card) => card.remove());
    pendingBulkDeleteCards = [];
    bulkDeletePending = false;
    $("#deleteStep").hidden = true;
    closeDialog();
    const remaining = document.querySelectorAll(".bookmark-card").length;
    $("#sideCount").textContent = String(remaining);
    $(".result-count").textContent = `${remaining} ${remaining === 1 ? "bookmark" : "bookmarks"}`;
    $("#selectedCount").textContent = "0 selected";
    showToast(`${deletedCount} bookmarks deleted`);
    return;
  }
  $("#deleteStep").hidden = true;
  closeDialog();
  $("#library").hidden = true;
  $("#emptyState").hidden = false;
  $("#sideCount").textContent = "0";
  const toast = $("#toast");
  toast.querySelector("span:last-child").textContent = "Bookmark deleted";
  toast.hidden = false;
});
$("#archiveBookmark").addEventListener("click", archiveCurrentBookmark);
$("#archiveFromMenu").addEventListener("click", archiveCurrentBookmark);
$("#archiveNav").addEventListener("click", showArchivedBookmark);
$("#browseArchive").addEventListener("click", showArchivedBookmark);
$("#restoreBookmark").addEventListener("click", () => {
  $(".bookmark-card").dataset.archived = "false";
  $("#restoreBookmark").hidden = true;
  $("#archiveCount").textContent = "0";
  $("#sideCount").textContent = "1";
  $("#archiveNav").classList.remove("selected");
  $("#allBookmarks").classList.add("active");
  $("#libraryTitle").textContent = "All bookmarks";
  $(".result-count").textContent = "1 bookmark";
  const toast = $("#toast");
  toast.querySelector("span:last-child").textContent = "Restored to All bookmarks";
  toast.hidden = false;
});

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

$("#clearNoResults").addEventListener("click", () => {
  $("#searchInput").value = "";
  applySearch("");
  $("#searchInput").focus();
});

$("#browseAll").addEventListener("click", () => {
  applyLabelFilter("");
});
$("#transferNav").addEventListener("click", openTransferPanel);
$("#libraryTools").addEventListener("click", () => {
  $("#libraryToolsMenu").hidden = !$("#libraryToolsMenu").hidden;
});
$("#toolsImport").addEventListener("click", openTransferPanel);
$("#toolsExport").addEventListener("click", openTransferPanel);

$("#sortSelect").addEventListener("change", (event) => sortLibrary(event.currentTarget.value));
document.querySelectorAll(".sort-buttons button").forEach((button) => {
  button.addEventListener("click", () => sortLibrary(button.dataset.sort));
});
$("#startSelection").addEventListener("click", enterSelectionMode);
$("#selectAll").addEventListener("change", (event) => {
  visibleBulkCheckboxes().forEach((checkbox) => { checkbox.checked = event.currentTarget.checked; });
  updateBulkSelection();
});
$("#cancelSelection").addEventListener("click", () => {
  document.querySelectorAll(".card-select input").forEach((checkbox) => { checkbox.checked = false; });
  document.querySelectorAll(".bookmark-card").forEach((card) => card.classList.remove("is-selected"));
  $("#bulkToolbar").hidden = true;
  if (bulkVersion === "a") {
    document.querySelectorAll(".card-select").forEach((control) => { control.hidden = true; });
    $("#startSelection").hidden = false;
  }
});

$("#bulkLater").addEventListener("click", () => {
  $("#bulkLaterMenu").hidden = !$("#bulkLaterMenu").hidden;
});

$("#bulkLabel").addEventListener("click", () => {
  $("#bulkLabelMenu").hidden = !$("#bulkLabelMenu").hidden;
  if (!$("#bulkLabelMenu").hidden) $("#bulkLabelInput").focus();
});
$("#bulkLabelInput").addEventListener("input", updateBulkLabelSuggestions);
$("#bulkLabelInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyBulkLabel(event.currentTarget.value);
  }
});

$("#bulkAddLater").addEventListener("click", () => {
  const selected = selectedBulkCards();
  selected.forEach((card) => { card.dataset.later = "true"; });
  $("#bulkLaterMenu").hidden = true;
  updateLaterCount();
  showToast(`${selected.length} bookmarks added to Read later`);
});

$("#bulkClearLater").addEventListener("click", () => {
  const selected = selectedBulkCards();
  selected.forEach((card) => { card.dataset.later = "false"; });
  $("#bulkLaterMenu").hidden = true;
  updateLaterCount();
  showToast(`${selected.length} bookmarks marked as read`);
});

$("#bulkArchive").addEventListener("click", () => {
  const selected = selectedBulkCards();
  selected.forEach((card) => {
    card.dataset.archived = "true";
    card.hidden = true;
    const checkbox = card.querySelector(".card-select input");
    checkbox.checked = false;
  });
  const archivedCount = [...document.querySelectorAll(".bookmark-card")]
    .filter((card) => card.dataset.archived === "true").length;
  const visibleCount = [...document.querySelectorAll(".bookmark-card")]
    .filter((card) => !card.hidden).length;
  $("#archiveNav").hidden = false;
  $("#archiveCount").textContent = String(archivedCount);
  $("#sideCount").textContent = String(visibleCount);
  $(".result-count").textContent = `${visibleCount} ${visibleCount === 1 ? "bookmark" : "bookmarks"}`;
  updateBulkSelection();
  showToast(`${selected.length} bookmarks moved to Archive`);
});
$("#bulkDelete").addEventListener("click", showBulkDeleteConfirmation);

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
if (pageState === "later-ready") showPreparedLaterLibrary();
if (pageState === "later-view") showActiveLaterView();
if (pageState === "later-empty") showEmptyLaterView();
if (pageState === "long-content") showLongContentLibrary();
if (pageState === "open-a") showLinkLibrary("a");
if (pageState === "open-b") showLinkLibrary("b");
if (pageState === "delete-a") showDeletePrototype("a");
if (pageState === "delete-b") showDeletePrototype("b");
if (pageState === "archive-a") showArchivePrototype("a");
if (pageState === "archive-b") showArchivePrototype("b");
if (pageState === "archive-search") showArchiveSearch();
if (pageState === "archive-restore") showRestorePrototype();
if (pageState === "sort-a") showSortLibrary("a");
if (pageState === "sort-b") showSortLibrary("b");
if (pageState === "bulk-a") showBulkLibrary("a");
if (pageState === "bulk-b") showBulkLibrary("b");
if (pageState === "bulk-selected") showBulkSelected();
if (pageState === "bulk-added") showBulkAdded();
if (pageState === "bulk-filtered") showBulkFiltered();
if (pageState === "bulk-label-ready") showBulkLabelReady();
if (pageState === "bulk-archive-ready") showBulkArchiveReady();
if (pageState === "bulk-delete-ready") showBulkDeleteReady();
if (pageState === "transfer-a") showTransferVersionA();
if (pageState === "transfer-b") showTransferVersionB();
if (pageState === "invalid-url") {
  openDialog();
  urlInput.value = "not a web address";
}
if (pageState === "fetch-failure") {
  openDialog();
  urlInput.value = "https://private.example.com/reading-list";
}
