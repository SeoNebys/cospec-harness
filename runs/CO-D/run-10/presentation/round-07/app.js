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

$("#saveBookmark").addEventListener("click", () => {
  $("#cardDomain").textContent = $("#previewDomain").textContent;
  $("#cardFavicon").textContent = $("#previewDomain").dataset.initial || "•";
  $("#cardTitle").textContent = $("#previewTitle").value.trim() || "Untitled bookmark";
  $("#cardDescription").textContent = $("#previewDescription").value.trim();
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
