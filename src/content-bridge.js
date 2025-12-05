// Inject the spy script
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/laitquipe-endpoints.js');
script.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Store endpoints in memory
let capturedEndpoints = [];

// Listen for messages from the spy script
window.addEventListener("message", (event) => {
    // We only accept messages from ourselves
    if (event.source !== window) return;

    if (event.data.type && event.data.type === "LAITQUIPE_ENDPOINT_LOG") {
        capturedEndpoints.push(event.data.payload);
        // Broadcast to popup if open
        try {
            chrome.runtime.sendMessage({ action: "newEndpoint", endpoint: event.data.payload });
        } catch (e) {
            // Popup is likely closed, ignore error
        }
    }
});

// Listen for requests from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getEndpoints") {
        sendResponse({ endpoints: capturedEndpoints });
    }
});
