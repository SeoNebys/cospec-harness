const $ = (selector) => document.querySelector(selector);

const backdrop = $("#backdrop");
const dialog = $("#saveDialog");
const urlStep = $("#urlStep");
const loadingStep = $("#loadingStep");
const previewStep = $("#previewStep");
const urlInput = $("#urlInput");

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
  $("#previewTitle").textContent = title;
  $("#previewDescription").textContent = description;
  $("#cardDomain").textContent = domain;
  $("#cardTitle").textContent = title;
  $("#cardDescription").textContent = description;
  $("#cardFavicon").textContent = initial;
}

$("#emptyAdd").addEventListener("click", openDialog);
$("#headerAdd").addEventListener("click", openDialog);
$("#closeDialog").addEventListener("click", closeDialog);
backdrop.addEventListener("click", closeDialog);

$("#sampleUrl").addEventListener("click", () => {
  urlInput.value = "https://www.atlasobscura.com/articles/ancient-libraries";
  urlInput.focus();
});

$("#urlForm").addEventListener("submit", (event) => {
  event.preventDefault();
  setPageDetails(urlInput.value);
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
  closeDialog();
  $("#emptyState").hidden = true;
  $("#library").hidden = false;
  $("#sideCount").textContent = "1";
  const toast = $("#toast");
  toast.hidden = false;
  setTimeout(() => { toast.hidden = true; }, 3500);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !dialog.hidden) closeDialog();
});
