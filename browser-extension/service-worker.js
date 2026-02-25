chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(
    { apiBaseUrl: "http://127.0.0.1:17832", inboxToken: "" },
    (settings) => {
      chrome.storage.sync.set(settings);
    }
  );
});
