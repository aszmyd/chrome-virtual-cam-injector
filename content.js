// Set up message passing between inject.js and chrome.storage
window.addEventListener("message", function (event) {
  // Only accept messages from the same frame
  if (event.source !== window) return;

  if (event.data.type === "GET_CAMERAS") {
    chrome.storage.local.get(["cameras"], (result) => {
      window.postMessage(
        {
          type: "CAMERAS_RESPONSE",
          cameras: result.cameras || [],
        },
        "*"
      );
    });
  }
});

// Inject the script
(function () {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("inject.js");
  (document.head || document.documentElement).appendChild(script);
  script.onload = function () {
    script.remove();
  };
})();

// Listen for storage changes and notify inject.js
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync" && changes.cameras) {
    window.postMessage(
      {
        type: "CAMERAS_UPDATED",
        cameras: changes.cameras.newValue || [],
      },
      "*"
    );
  }
});
