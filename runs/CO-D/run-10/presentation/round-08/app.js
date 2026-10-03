const $ = (selector) => document.querySelector(selector);

const backdrop = $("#backdrop");
const dialog = $("#saveDialog");
const urlStep = $("#urlStep");
const loadingStep = $("#loadingStep");
const previewStep = $("#previewStep");
const urlInput = $("#urlInput");
const sampleAddress = "https://www.atlasobscura.com/articles/ancient-libraries";
const pageState = new URLSearchParams(window.location.search).get("state");
let hasExistingBookmark = pageState === "duplicate";
let editingDuplicate = false;
let labels = [];

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
  const label = value.trim();
  if (label && !labels.some((item) => item.toLowerCase() === label.toLowerCase())) {
    labels.push(label);
    renderLabels();
  }
}

function showLabelEditor(version) {
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
    : "Bookmark saved to your library";
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
