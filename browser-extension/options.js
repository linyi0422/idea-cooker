const defaults = {
  apiBaseUrl: "http://127.0.0.1:17832",
  inboxToken: "",
};

const apiBaseUrlInput = document.getElementById("apiBaseUrl");
const inboxTokenInput = document.getElementById("inboxToken");
const status = document.getElementById("status");

function setStatus(message) {
  status.textContent = message;
}

chrome.storage.sync.get(defaults, (settings) => {
  apiBaseUrlInput.value = settings.apiBaseUrl || defaults.apiBaseUrl;
  inboxTokenInput.value = settings.inboxToken || "";
});

document.getElementById("saveBtn").addEventListener("click", () => {
  const apiBaseUrl = apiBaseUrlInput.value.trim() || defaults.apiBaseUrl;
  const inboxToken = inboxTokenInput.value.trim();
  chrome.storage.sync.set({ apiBaseUrl, inboxToken }, () => {
    setStatus("Saved.");
  });
});
