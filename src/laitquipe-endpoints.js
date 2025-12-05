(function () {
    const originalLog = console.log;
    // Regex updated to handle multiline logs:
    // \[(\d+)\]\s+(GET|POST|PUT|DELETE|PATCH) matches the first line
    // \s+ matches the newline
    // (https?:\/\/\S+) matches the URL on the second line
    const REGEX = /^\[(\d+)\]\s+(GET|POST|PUT|DELETE|PATCH)\s+(https?:\/\/\S+)/m;

    console.log = function (...args) {
        // Always execute original
        originalLog.apply(console, args);

        try {
            // Check arguments for pattern
            // We join with space to handle multiple arguments
            // We remove %c which is used for styling to avoid noise
            const logContent = args.join(' ').replace(/%c/g, '');

            // 1. Look for [Status] Method
            const methodMatch = logContent.match(/\[(\d+)\]\s+(GET|POST|PUT|DELETE|PATCH)/i);

            // 2. Look for URL
            const urlMatch = logContent.match(/(https?:\/\/[^\s"']+)/);

            if (methodMatch && urlMatch) {
                const status = methodMatch[1];
                const method = methodMatch[2].toUpperCase();
                const urlStr = urlMatch[1];

                let service = "AUTRE";
                try {
                    const urlObj = new URL(urlStr);
                    // Extract service from path: /api/SERVICE/...
                    const pathParts = urlObj.pathname.split('/');
                    const apiIndex = pathParts.indexOf('api');
                    if (apiIndex !== -1 && apiIndex + 1 < pathParts.length) {
                        service = pathParts[apiIndex + 1].toUpperCase();
                    }
                } catch (e) {
                    // Invalid URL, keep default service
                }

                window.postMessage({
                    type: "LAITQUIPE_ENDPOINT_LOG",
                    payload: {
                        status: parseInt(status),
                        method,
                        url: urlStr,
                        service,
                        timestamp: Date.now()
                    }
                }, "*");
            }
        } catch (e) {
            // Safety net
        }
    };
})();
