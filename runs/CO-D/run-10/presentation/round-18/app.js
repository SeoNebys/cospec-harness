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

$("#saveBookmark").addEventListener("click", () => {
  $("#cardDomain").textContent = $("#previewDomain").textContent;
  $("#cardFavicon").textContent = $("#previewDomain").dataset.initial || "•";
  $("#cardTitle").textContent = $("#previewTitle").value.trim() || "Untitled bookmark";
  $("#cardDescription").textContent = $("#previewDescription").value.trim();
  $(".bookmark-card").dataset.note = $("#noteInput").value.trim();
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
