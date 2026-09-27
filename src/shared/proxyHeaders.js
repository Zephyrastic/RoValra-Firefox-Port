// Shared header handling for the content <-> background fetch proxies.
//
// A proxied body travels between contexts as already-decoded text, so the
// original transfer framing/encoding headers no longer describe it.
// Forwarding them makes the rebuilt Response unreadable on some engines
// (Firefox serves brotli/gzip here), so both proxies strip the same set.

// Bodies handed back to a content script travel as already-decoded text, so
// the original transfer framing/encoding headers no longer describe them.
export const PROXY_STRIPPED_RESPONSE_HEADERS = new Set([
    'content-encoding',
    'content-length',
    'transfer-encoding',
    'connection',
    'keep-alive',
    'upgrade',
    'trailer',
    'te',
]);

function isProxiedHeaderExcluded(name) {
    return PROXY_STRIPPED_RESPONSE_HEADERS.has(String(name).toLowerCase());
}

// For plain header objects ({ name: value }).
export function sanitizeProxiedHeaders(headers) {
    const sanitized = {};
    Object.entries(headers || {}).forEach(([key, value]) => {
        if (!isProxiedHeaderExcluded(key)) {
            sanitized[key] = value;
        }
    });
    return sanitized;
}

// For fetch Headers instances (background side).
export function collectProxyResponseHeaders(response) {
    const headers = {};
    response.headers.forEach((value, key) => {
        if (!isProxiedHeaderExcluded(key)) {
            headers[key] = value;
        }
    });
    return headers;
}
